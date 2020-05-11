export interface Stream {
    readonly name: string
    readonly link: string
    readonly country?: string | undefined
    readonly lang?: string | undefined
    readonly viewers: number
}
