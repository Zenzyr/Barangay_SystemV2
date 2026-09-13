export const formattedDate = () => {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "medium",
    }).format(new Date());
} 