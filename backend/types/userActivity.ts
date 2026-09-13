export interface userActivityInterfaceInput {
    accountId : string,
    activity: string,
    date : string,
}

export interface userActivityInterface extends userActivityInterfaceInput {
    _id : string,
}
