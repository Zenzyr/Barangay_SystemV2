import { accountInterface } from "./accounts.type";

export interface businessInterfaceInput {
    resident: string,
    businessName: string,
    type: string,
    businessInfo: string,
    address: string,
    logo: string,
    document: string,
    images: string[],
    status: string,
}

export interface businessInterface {
    _id: string,
    resident: accountInterface,
    businessName: string,
    type: string,
    businessInfo: string,
    address: string,
    logo: string,
    document: string,
    images: string[],
    status: string,
}
