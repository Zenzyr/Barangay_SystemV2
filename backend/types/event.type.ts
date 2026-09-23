export interface eventInterfaceInput {
    title: string;
    description?: string;
    category?: string;
    date: Date;
    startTime?: string;
    endTime?: string;
    location?: string;
    organizer?: string;
    status?: "upcoming" | "completed" | "cancelled";
    maxParticipants?: number;
    attendees?: string[];
    createdBy?: string;
    isArchived?: boolean;
    archivedAt?: Date;
}

export interface eventInterface extends eventInterfaceInput {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
}