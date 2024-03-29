
import 'reflect-metadata';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Container, decorate, injectable } from 'inversify';
import { InversifyTracer } from './../src/tracer';
import { InvalidFilterError } from './../src/invalid-filter-error';
import { InvalidTracerEventError } from './../src/invalid-tracer-event-error';
import { CallInfo, ReturnInfo, Parameter } from './../src/proxy-listener';

import { TestObject } from './test-object';

class NotTracedTestObject {
    public methodWithValue(value: any) { return value; }
}

decorate(injectable(), TestObject);
decorate(injectable(), NotTracedTestObject);

describe('InversifyTracer', () => {

    context('new tracer with invalid filter', () => {

        it('should throw InvalidFilterError', () => {
            expect(() => { new InversifyTracer({ filters: ['invalid!"#!filter'] }); }).to.throw(InvalidFilterError);
        });
    });

    context('invalid event', () => {
        const tracer = new InversifyTracer();

        it('should throw InvalidFilterError', () => {
            expect(() => { tracer.on('invalid-event', () => { return; }); }).to.throw(InvalidTracerEventError);
        });
    });

    context('partial filter', () => {

        it('should throw InvalidFilterError', () => {

            const tracer: InversifyTracer = new InversifyTracer({ filters: ['Test'] });

            expect((tracer as any).classFilter.includeFilters).to.have.length(1);
            expect((tracer as any).classFilter.excludeFilters).to.have.length(0);
            expect((tracer as any).classFilter.includeFilters[0]).to.be.equal('Test');
            expect((tracer as any).proxyListener.methodFilter.includeFilters).to.have.length(1);
            expect((tracer as any).proxyListener.methodFilter.excludeFilters).to.have.length(0);
            expect((tracer as any).proxyListener.methodFilter.includeFilters[0]).to.be.equal('Test:*');
        });
    });

    context('negative partial filter', () => {

        it('should throw InvalidFilterError', () => {

            const tracer: InversifyTracer = new InversifyTracer({ filters: ['!Test'] });

            expect((tracer as any).classFilter.includeFilters).to.have.length(0);
            expect((tracer as any).classFilter.excludeFilters).to.have.length(1);
            expect((tracer as any).classFilter.excludeFilters[0]).to.be.equal('!Test');
            expect((tracer as any).proxyListener.methodFilter.includeFilters).to.have.length(0);
            expect((tracer as any).proxyListener.methodFilter.excludeFilters).to.have.length(1);
            expect((tracer as any).proxyListener.methodFilter.excludeFilters[0]).to.be.equal('!Test:*');
        });
    });

    context('container with a class', () => {

        let tracer: InversifyTracer;
        let container: Container;

        before(() => {
            tracer = new InversifyTracer();
            container = new Container();

            container.bind<TestObject>('TestObject').to(TestObject);

            tracer.apply(container);
        });

        it('should proxy all methods and emit \"call\" and \"return\" events', () => {

            const testObject = container.get<TestObject>('TestObject');

            const callSpy: sinon.SinonSpy = sinon.spy();
            const returnSpy: sinon.SinonSpy = sinon.spy();

            tracer.on('call', callSpy);
            tracer.on('call', (callInfo: CallInfo) => {
                expect(callInfo.className).to.be.equal('TestObject');
                expect(callInfo.methodName).to.be.equal('methodWithValue');
                expect(callInfo.parameters).to.have.length(1);
                expect(callInfo.parameters[0]).to.contain({
                    name: 'value',
                    value: 32
                } as Parameter);
            });

            tracer.on('return', returnSpy);
            tracer.on('return', (returnInfo: ReturnInfo) => {
                expect(returnInfo.className).to.be.equal('TestObject');
                expect(returnInfo.methodName).to.be.equal('methodWithValue');
                expect(returnInfo.result).to.be.equal(32);
            });

            testObject.methodWithValue(32);

            expect(callSpy.calledOnce).to.be.true;
            expect(returnSpy.calledOnce).to.be.true;
        });
    });

    context('container with a class (singleton)', () => {

        let tracer: InversifyTracer;
        let container: Container;

        before(() => {
            tracer = new InversifyTracer();
            container = new Container();

            container.bind<TestObject>('TestObject').to(TestObject).inSingletonScope();

            tracer.apply(container);
        });

        it('should proxy all methods and emit \"call\" and \"return\" events', () => {

            // force cache
            const testObjectFirst = container.get<TestObject>('TestObject');

            const testObject = container.get<TestObject>('TestObject');

            expect(testObjectFirst).to.be.equal(testObject);

            const callSpy: sinon.SinonSpy = sinon.spy();
            const returnSpy: sinon.SinonSpy = sinon.spy();

            tracer.on('call', callSpy);
            tracer.on('call', (callInfo: CallInfo) => {
                expect(callInfo.className).to.be.equal('TestObject');
                expect(callInfo.methodName).to.be.equal('methodWithValue');
                expect(callInfo.parameters).to.have.length(1);
                expect(callInfo.parameters[0]).to.contain({
                    name: 'value',
                    value: 32
                } as Parameter);
            });

            tracer.on('return', returnSpy);
            tracer.on('return', (returnInfo: ReturnInfo) => {
                expect(returnInfo.className).to.be.equal('TestObject');
                expect(returnInfo.methodName).to.be.equal('methodWithValue');
                expect(returnInfo.result).to.be.equal(32);
            });

            testObject.methodWithValue(32);

            expect(callSpy.calledOnce).to.be.true;
            expect(returnSpy.calledOnce).to.be.true;
        });
    });

    context('container with two classes and only trace one', () => {

        let tracer: InversifyTracer;
        let container: Container;

        before(() => {
            tracer = new InversifyTracer({ filters: ['TestObject'] });
            container = new Container();

            container.bind<TestObject>('TestObject').to(TestObject);
            container.bind<NotTracedTestObject>('NotTracedTestObject').to(NotTracedTestObject);

            tracer.apply(container);
        });

        it('should only proxy TestObject methods and emit \"call\" and \"return\" events', () => {

            const testObject = container.get<TestObject>('TestObject');

            const callSpy: sinon.SinonSpy = sinon.spy();
            const returnSpy: sinon.SinonSpy = sinon.spy();

            tracer.on('call', callSpy);
            tracer.on('call', (callInfo: CallInfo) => {
                expect(callInfo.className).to.be.equal('TestObject');
                expect(callInfo.methodName).to.be.equal('methodWithValue');
                expect(callInfo.parameters).to.have.length(1);
                expect(callInfo.parameters[0]).to.contain({
                    name: 'value',
                    value: 32
                } as Parameter);
            });

            tracer.on('return', returnSpy);
            tracer.on('return', (returnInfo: ReturnInfo) => {
                expect(returnInfo.className).to.be.equal('TestObject');
                expect(returnInfo.methodName).to.be.equal('methodWithValue');
                expect(returnInfo.result).to.be.equal(32);
            });

            testObject.methodWithValue(32);

            expect(callSpy.calledOnce).to.be.true;
            expect(returnSpy.calledOnce).to.be.true;

            const notTracedTestObject = container.get<NotTracedTestObject>('NotTracedTestObject');

            notTracedTestObject.methodWithValue(32);

            expect(callSpy.calledOnce).to.be.true;
            expect(returnSpy.calledOnce).to.be.true;
        });
    });

    context('container with a binding that has an onActivation function', () => {

        let tracer: InversifyTracer;
        let container: Container;

        const onActivationSpy: sinon.SinonSpy = sinon.spy((context: any, newObject: any) => {
            return newObject;
        });

        before(() => {
            tracer = new InversifyTracer();
            container = new Container();

            container.bind<TestObject>('TestObject').to(TestObject).onActivation(onActivationSpy);

            tracer.apply(container);
        });

        it('should not override the onActivation function and call it', () => {

            container.get<TestObject>('TestObject');

            expect(onActivationSpy.calledOnce).to.be.true;

            container.get<TestObject>('TestObject');

            expect(onActivationSpy.calledTwice).to.be.true;
        });
    });

    context('container with a class containing a slow method', () => {

        let tracer: InversifyTracer;
        let container: Container;

        const onActivationSpy: sinon.SinonSpy = sinon.spy((context: any, newObject: any) => {
            return newObject;
        });

        before(() => {
            tracer = new InversifyTracer();
            container = new Container();

            container.bind<TestObject>('TestObject').to(TestObject).onActivation(onActivationSpy);

            tracer.apply(container);
        });

        it('should return a ReturnInfo with an execution time greater than 10ms', (done) => {

            const testObject = container.get<TestObject>('TestObject');

            const callSpy: sinon.SinonSpy = sinon.spy();
            const returnSpy: sinon.SinonSpy = sinon.spy();

            const time: number = 10;

            tracer.on('call', callSpy);
            tracer.on('call', (callInfo: CallInfo) => {
                expect(callInfo.className).to.be.equal('TestObject');
                expect(callInfo.methodName).to.be.equal('methodPromiseResolveWithTimerAndValue');
                expect(callInfo.parameters).to.have.length(2);
                expect(callInfo.parameters[0]).to.contain({
                    name: 'time',
                    value: time
                } as Parameter);
                expect(callInfo.parameters[1]).to.contain({
                    name: 'value',
                    value: 32
                } as Parameter);
            });

            tracer.on('return', returnSpy);
            tracer.on('return', (returnInfo: ReturnInfo) => {
                expect(returnInfo.className).to.be.equal('TestObject');
                expect(returnInfo.methodName).to.be.equal('methodPromiseResolveWithTimerAndValue');
                expect(returnInfo.executionTime).to.be.greaterThan(time);
                expect(returnInfo.result).to.be.equal(32);

                expect(returnSpy.calledOnce).to.be.true;
                done();
            });

            testObject.methodPromiseResolveWithTimerAndValue(time, 32);

            expect(callSpy.calledOnce).to.be.true;
        });
    });
});
