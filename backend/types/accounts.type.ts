export interface accountInterfaceInput {
    profile?: string,
    name: string,
    address?: string,
    contact?: string,
    email: string,

    gender?: string,
    dateOfBirth?: string,
    civilStatus?: string,
    purok?: string,
    voterStatus?: string,
    houseHoldNumber?: string,

    password: string,
    status :  string,
    role?: "resident" | "secretary" | "super_admin",
    identityHash?: string,
    possibleDuplicate?: {
        status?: string,
        reason?: string,
        records?: { type?: string, id?: string, name?: string }[],
    },
    idImg : {
        idFront?  :  string,
        idBack? :  string,
        idSelfie? :  string,
    },
    legalConsent?: {
        privacyPolicy?: boolean,
        termsOfService?: boolean,
    },
    skills : {
        skill  :  string,
        experience : number,
        proficiency :  string,
        serviceTypes? : string[],
        availability? : string,
        services? : string[],
    }[],
    reviews : {
        user :   string,
        userProfile : string,
        star  :  number,
        skill :  string,
        message :  string,
    }[],
}

export interface accountInterface extends accountInterfaceInput {
    _id : string,
}