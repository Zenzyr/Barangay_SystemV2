import { accountInterface } from "./account.type";

export interface documentRequestInterfaceInput {
    resident?: string | null,
    document: string,
    status : string,
    isPaid : boolean,
    price : number,

    fullName : string | null,
    contact: string | null,
    address: string | null,
    dateOfBirth: string | null,
    civilStatus: string | null,
    nationality: string | null,
    occupation: string | null,
    yrsOfResidency: number | null,

    purpose : string | null,
    documentNumber : string | null,
    dateIssued : string | null,

    businessName : string | null,
    businessAddress : string | null,
    businessType : string | null,
    businessNature : string | null,

    workStatus: string | null,
    workplace: string | null,
    monthlyIncome: string | null,
    expenseType: string | null,
    householdExpenses: string | null,
    assistanceTo: string | null,
    titleNo: string | null,
    taxDeclarationNo: string | null,
    landArea: string | null,
    treeCount: string | null,
    treeType: string | null,
    age: string | null,
    spouseName: string | null,
    annualIncome: string | null,
    purok: string | null,
}

export interface statusHistoryEntry {
    status: string;
    at: string;
}

export interface documentRequestInterface {
    _id : string,
    resident?: accountInterface | null,
    document: string,
    status : string,
    isPaid : boolean,

    fullName : string | null,
    contact: string | null,
    address: string | null,
    dateOfBirth: string | null,
    civilStatus: string | null,
    nationality: string | null,
    occupation: string | null,
    yrsOfResidency: number | null,

    purpose : string | null,
    documentNumber : string | null,
    dateIssued : string | null,

    businessName : string | null,
    businessAddress : string | null,
    businessType : string | null,
    businessNature : string | null,

    workStatus: string | null,
    workplace: string | null,
    monthlyIncome: string | null,
    expenseType: string | null,
    householdExpenses: string | null,
    assistanceTo: string | null,
    titleNo: string | null,
    taxDeclarationNo: string | null,
    landArea: string | null,
    treeCount: string | null,
    treeType: string | null,
    age: string | null,
    spouseName: string | null,
    annualIncome: string | null,
    purok: string | null,
    requestDate?: string | null;
    requestTime?: string | null;
    source?: "online" | "walk-in";
    isArchived?: boolean;
    archivedAt?: string | null;
    statusHistory?: statusHistoryEntry[];
    createdAt?: string;
    updatedAt?: string;
}