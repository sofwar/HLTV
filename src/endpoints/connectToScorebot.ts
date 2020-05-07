import * as io from "socket.io-client"
import { ScoreboardUpdate } from '../models/ScoreboardUpdate'
import { LogUpdate } from '../models/LogUpdate'
import { fetchPage } from '../utils/mappers'
import { HLTVConfig } from '../config'

export type ConnectToScorebotParams = {
    id: number
    onScoreboardUpdate?: (data: ScoreboardUpdate, done: () => void) => any
    onLogUpdate?: (data: LogUpdate, done: () => void) => any
    onFullLogUpdate?: (data: unknown, done: () => void) => any
    onScoreUpdate?: (data: unknown, done: () => void) => any
    onConnect?: (init: boolean, typeSocket: string) => any
    onDisconnect?: () => any
}


export const connectToScorebot = (config: HLTVConfig) => ({
    id,
    onScoreboardUpdate,
    onLogUpdate,
    onFullLogUpdate,
    onScoreUpdate,
    onConnect,
    onDisconnect
}: ConnectToScorebotParams) => {
    fetchPage(`${config.hltvUrl}/matches/${id}/-`, config.loadPage)
        .then($ => {
            const scoreboardElement = $('#scoreboardElement');

            if (!scoreboardElement.length) {
                if (onConnect) {
                    onConnect(false, 'all')
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
                listId: matchId
            })

            socket.on('connect', () => {
                const done = () => socket.close()

                if (onConnect) {
                    onConnect(true, 'match')
                }

                socket.emit('readyForMatch', initObject)

                socket.on('scoreboard', data => {
                    if (onScoreboardUpdate) {
                        onScoreboardUpdate(data, done)
                    }
                })

                socket.on('log', data => {
                    if (onLogUpdate) {
                        onLogUpdate(JSON.parse(data), done)
                    }
                })

                socket.on('fullLog', data => {
                    if (onFullLogUpdate) {
                        onFullLogUpdate(JSON.parse(data), done)
                    }
                })
            })

            socket.on('reconnect', () => {
                socket.emit('readyForMatch', initObject)
            })

            socket.on('disconnect', () => {
                if (onDisconnect) {
                    onDisconnect()
                }
            })

            if (onScoreUpdate) {
                const socketScore = io.connect(url, {agent: !config.httpAgent})

                socketScore.on('connect', () => {
                    const done = () => socket.close()

                    if (onConnect) {
                        onConnect(true, 'score')
                    }

                    socketScore.emit('readyForScores', initObject)

                    socketScore.on('score', data => {
                        onScoreUpdate(data, done)
                    })
                })

                socketScore.on('reconnect', () => {
                    socketScore.emit('readyForScores', initObject)
                })

                socketScore.on('disconnect', () => {
                    if (onDisconnect) {
                        onDisconnect()
                    }
                })
            }
        })
}
