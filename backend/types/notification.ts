export interface notificationInterfaceInput {
    accountId: string,
    title: string,
    message: string,
    type: string,
}

export interface notificationInterface extends notificationInterfaceInput {
    _id: string,
    read: boolean,
    createdAt: string,
}