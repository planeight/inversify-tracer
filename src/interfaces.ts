
interface BaseInfo {
	className: string;
	methodName: string;
}

export interface CallInfo extends BaseInfo {
	arguments: any[];
	parameters: string[];
}

export interface ReturnInfo extends BaseInfo {
	result: any;
}

export interface TracerOptions {
	filters?: string[];
	inspectReturnedPromise?: boolean;
}

export declare type OnCall = (callInfo: CallInfo) => void;
export declare type OnReturn = (returnInfo: ReturnInfo) => void;
