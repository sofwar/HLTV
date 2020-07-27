import { defaultLoadPage } from './utils/mappers'
import { Agent as HttpsAgent } from 'https'
import { Agent as HttpAgent } from 'http'
import { randomBytes } from 'crypto'

export interface HLTVConfig {
    hltvUrl?: string
    hltvStaticUrl?: string
    loadPage?: (url: string) => Promise<string>
    httpAgent?: HttpsAgent | HttpAgent,
    strRandom: (size: number) => string
}

const defaultAgent = new HttpsAgent()

export const defaultConfig: HLTVConfig = {
    hltvUrl: 'https://www.hltv.org',
    hltvStaticUrl: 'https://static.hltv.org',
    httpAgent: defaultAgent,
    strRandom: (size) => randomBytes(size).toString('hex'),
    loadPage: defaultLoadPage(defaultAgent)
}
