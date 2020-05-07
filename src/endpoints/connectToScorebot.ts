import * as io from "socket.io-client"
import { fetchPage } from '../utils/mappers'
import { HLTVConfig } from '../config'

export type ConnectToScorebotParams = {
    id: number
    onScoreUpdate?: (data: unknown, done: () => void) => any
    onConnect?: (init: boolean) => any
    onDisconnect?: () => any
}

export const connectToScorebot = (config: HLTVConfig) => ({
    id,
    onScoreUpdate,
    onConnect,
    onDisconnect
}: ConnectToScorebotParams) => {
    fetchPage(`${config.hltvUrl}/matches/${id}/-`, config.loadPage)
        .then($ => {
            const scoreboardElement = $('#scoreboardElement');

            if (!scoreboardElement.length) {
                if (onConnect) {
                    onConnect(false)
                }

                return
            }

            const url = scoreboardElement
                .attr('data-scorebot-url')!
                .split(',')
                .pop()!

            const matchId = scoreboardElement.attr('data-scorebot-id')

            const socket = io.connect(url, {
                agent: !config.httpAgent
            })

            const initObject = JSON.stringify({
                token: '',
                listIds: [matchId]
            })

            socket.on('connect', () => {
                const done = () => socket.close()

                if (onConnect) {
                    onConnect(true)
                }

                socket.emit('readyForScores', initObject)

                socket.on('score', data => {
                    if (onScoreUpdate) {
                        onScoreUpdate(data, done)
                    }
                })
            })

            socket.on('reconnect', () => {
                socket.emit('readyForScores', initObject)
            })

            socket.on('disconnect', () => {
                if (onDisconnect) {
                    onDisconnect()
                }
            })
        })
}
