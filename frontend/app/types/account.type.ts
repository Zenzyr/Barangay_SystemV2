export interface accountInterfaceInput {
    profile : string,
    name: string,
    address: string,
    email: string,
    contact: string,
    password: string,
    status :  string,
    role?: "resident" | "secretary" | "super_admin",
    possibleDuplicate?: {
        status?: string,
        reason?: string,
        records?: { type?: string, id?: string, name?: string }[],
    },
    gender: string,
    dateOfBirth: string,
    civilStatus: string,
    purok: string,
    voterStatus: string,
    houseHoldNumber: string,

    idImg : {
        idFront  :  string,
        idBack :  string,
        idSelfie :  string,
    },
    skills : {
        skill  :  string,
        experience : number,
        proficiency :  string,
        serviceTypes? : string[],
    }[],
    reviews : {
        _id? : string,
        user :   string,
        userProfile : string,
        star  :  number,
        skill :  string,
        message :  string,
    }[],
    averageRating? : number,
    totalReviews? : number,
    availability? : "AVAILABLE" | "BUSY" | "NOT_AVAILABLE",
    providerLocation? : string,
    providerDescription? : string,
    completedServices? : number,
}

export interface accountInterface extends accountInterfaceInput {
    _id : string,
    createdAt? : string,
    updatedAt? : string,
}