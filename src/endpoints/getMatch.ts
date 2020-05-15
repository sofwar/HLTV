import {FullMatch} from '../models/FullMatch'
import {Event} from '../models/Event'
import {MapResult} from '../models/MapResult'
import {OddResult, CommunityOddResult} from '../models/OddResult'
import {Player} from '../models/Player'
import {Stream} from '../models/Stream'
import {Team} from '../models/Team'
import {Demo} from '../models/Demo'
import {Highlight} from '../models/Highlight'
import {Veto} from '../models/Veto'
import {HeadToHeadResult} from '../models/HeadToHeadResult'
import {MapSlug} from '../enums/MapSlug'
import {MatchStatus} from '../enums/MatchStatus'
import {popSlashSource, hasChild, hasNoChild, percentageToDecimalOdd} from '../utils/parsing'
import {HLTVConfig} from '../config'
import {
    fetchPage,
    toArray,
    mapVetoElementToModel,
    getMapSlug,
    getMatchPlayer,
    getMatchFormat
} from '../utils/mappers'

export const getMatch = (config: HLTVConfig) => async ({
                                                           id
                                                       }: {
    id: number
}): Promise<FullMatch> => {
    const $ = await fetchPage(`${config.hltvUrl}/matches/${id}/-`, config.loadPage)

    const title = $('.timeAndEvent .text').text().trim() || undefined

    const date = Number($('.timeAndEvent .date').attr('data-unix'))

    const preformattedText = $('.preformatted-text').text().split('\n')

    const format = getMatchFormat(preformattedText[0])

    const additionalInfo = preformattedText.slice(1).join(' ').trim()

    let status = MatchStatus.Scheduled

    if (!$('.countdown').attr('data-time-countdown')) {
        status = $('.countdown').text() as MatchStatus
    } else if ($('.countdown').text() === MatchStatus.Live) {
        status = MatchStatus.Live
    }

    let tie = false

    const live = status === MatchStatus.Live
    const hasScorebot = $('#scoreboardElement').length !== 0

    const teamEls = $('div.teamName')

    const team1: Team = {
        id: 0,
        name: 'TBD',
        logo: null
    }

    const team2: Team = {
        id: 0,
        name: 'TBD',
        logo: null
    }

    const scores = {}

    if (teamEls.first().text()) {
        team1.id = Number(popSlashSource(teamEls.first().prev()))
        team1.name = teamEls.eq(0).text()
        team1.logo = teamEls.first().prev().attr('src');

        scores[team1.id] = 0
    } else {
        scores['TBD-1'] = 0
    }

    if (teamEls.last().text()) {
        team2.id = Number(popSlashSource(teamEls.last().prev()))
        team2.name = teamEls.eq(1).text()
        team2.logo = teamEls.last().prev().attr('src')!;

        scores[team2.id] = 0
    } else {
        scores['TBD-2'] = 0
    }

    let winnerTeam: Team | undefined

    if ($('.team1-gradient').children().last().hasClass('won')) {
        winnerTeam = team1
    } else if ($('.team2-gradient').children().last().hasClass('won')) {
        winnerTeam = team2
    }

    let vetoes: Veto[] | undefined

    if (team1.id > 0 && team2.id > 0) {
        vetoes = toArray(
            $('.veto-box')
                .last()
                .find('.padding > div')
        )
            .slice(0, -1)
            .map(el => mapVetoElementToModel(el, team1, team2))
    }

    const event: Event = {
        name: $('.timeAndEvent .event').text(),
        id: Number(
            $('.timeAndEvent .event')
                .children()
                .first()
                .attr('href')!
                .split('/')[2]
        )
    }

    const odds: OddResult[] = toArray($('tr.provider:not(.hidden)'))
        .filter(hasNoChild('.noOdds'))
        .map(oddElement => {
            let convertOdds =
                oddElement
                    .find('.odds-cell')
                    .first()
                    .text()
                    .indexOf('%') >= 0

            let oddTeam1 = Number(
                oddElement
                    .find('.odds-cell')
                    .first()
                    .find('a')
                    .text()
                    .replace('%', '')
            )

            let oddTeam2 = Number(
                oddElement
                    .find('.odds-cell')
                    .last()
                    .find('a')
                    .text()
                    .replace('%', '')
            )

            if (convertOdds) {
                oddTeam1 = percentageToDecimalOdd(oddTeam1)
                oddTeam2 = percentageToDecimalOdd(oddTeam2)
            }

            return {
                provider: oddElement
                    .prop('class')
                    .split('gprov_')[1]
                    .split(' ')[0]
                    .trim(),
                team1: oddTeam1,
                team2: oddTeam2
            }
        })

    let oddsCommunity: CommunityOddResult | undefined

    if ($('.pick-a-winner-team').length == 2) {
        oddsCommunity = {
            team1: percentageToDecimalOdd(
                Number(
                    $('.pick-a-winner-team')
                        .first()
                        .find('.percentage')
                        .text()
                        .replace('%', '')
                )
            ),
            team2: percentageToDecimalOdd(
                Number(
                    $('.pick-a-winner-team')
                        .last()
                        .find('.percentage')
                        .text()
                        .replace('%', '')
                )
            )
        }
    }

    const maps: MapResult[] = toArray($('.mapholder')).map(mapEl => {
        const team1Rounds = mapEl
            .find('.results-left .results-team-score')
            .text()
            .trim()

        const team2Rounds = mapEl
            .find('.results-right .results-team-score')
            .text()
            .trim()

        const halfs = mapEl
            .find('.results-center-half-score')
            .text()
            .trim()

        const statsId = mapEl.find('.results-stats').length ? Number(
            mapEl
                .find('.results-stats')
                .attr('href')!
                .split('/')[4]
            )
            : undefined

        if (statsId) {
            if (team1Rounds !== team2Rounds) {
                scores[team1Rounds > team2Rounds ? team1.id : team2.id]++
            } else {
                tie = true
            }
        }

        const mapScores = {}

        mapScores[team1.id] = team1Rounds
        mapScores[team2.id] = team2Rounds

        return {
            name: getMapSlug(mapEl.find('.mapname').text()),
            result: team1Rounds ? `${team1Rounds}:${team2Rounds} ${halfs}` : undefined,
            scores: mapScores,
            statsId: statsId
        }
    })

    let players: { team1: Player[]; team2: Player[] } | undefined

    if (team1.id > 0 && team2.id > 0) {
        players = {
            team1: toArray(
                $('div.players')
                    .first()
                    .find('tr')
                    .last()
                    .find('.flagAlign')
            ).map(getMatchPlayer),
            team2: toArray(
                $('div.players')
                    .last()
                    .find('tr')
                    .last()
                    .find('.flagAlign')
            ).map(getMatchPlayer)
        }
    }

    let streams: Stream[] = toArray($('.stream-box-embed'))
        .filter(hasChild('.stream-flag'))
        .map(streamEl => {
            const flagEl = streamEl.find('.stream-flag');
            const country = flagEl.length ? streamEl.find('.stream-flag').attr('title') : undefined;
            let lang = 'en';

            if (country) {
                if (country === 'Germany') {
                    lang = 'de'
                } else if (country === 'Poland') {
                    lang = 'pl'
                } else if (country === 'Hungary') {
                    lang = 'hu'
                } else if (country === 'Denmark') {
                    lang = 'da'
                } else if (country === 'Russia') {
                    lang = 'ru'
                } else if (country === 'France') {
                    lang = 'fr'
                } else if (country === 'Serbia') {
                    lang = 'rs'
                }
            }

            return {
                name: streamEl.text(),
                link: streamEl.attr('data-stream-embed')!,
                country: country,
                lang: lang,
                viewers: Number(streamEl.parent().find('.viewers.left-right-padding').text())
            }
        })

    if ($('.stream-box.gotv').length !== 0) {
        streams.push({
            name: 'GOTV',
            link: $('.stream-box.gotv')
                .text()
                .replace('GOTV: connect', '')
                .trim(),
            country: undefined,
            lang: 'en',
            viewers: 0
        })
    }

    const demos: Demo[] = toArray($('div[class="stream-box"]:not(:has(.stream-box-embed))')).map(
        demoEl => {
            const gotvEl = demoEl.find('.left-right-padding')

            if (gotvEl.length !== 0) {
                return {name: gotvEl.text(), link: gotvEl.attr('href')!}
            }

            return {name: demoEl.find('.spoiler').text(), link: demoEl.attr('data-stream-embed')!}
        }
    )

    const highlightedPlayerLink: string | undefined = $('.highlighted-player')
        .find('.flag')
        .next()
        .attr('href')

    const highlightedPlayer: Player | undefined = highlightedPlayerLink
        ? {
            name: highlightedPlayerLink.split('/').pop()!,
            id: Number(highlightedPlayerLink.split('/')[2])
        }
        : undefined

    let headToHead: HeadToHeadResult[] | undefined

    if (team1 && team2) {
        headToHead = toArray($('.head-to-head-listing tr')).map(matchEl => {
            const date = Number(matchEl.find('.date a span').attr('data-unix'))
            const map = matchEl.find('.dynamic-map-name-short').text() as MapSlug
            const isDraw = matchEl.find('.winner').length === 0

            let winner: Team | undefined

            if (!isDraw) {
                winner = {
                    name: matchEl
                        .find('.winner .flag')
                        .next()
                        .text(),
                    id: Number(
                        matchEl
                            .find('.winner .flag')
                            .next()
                            .attr('href')!
                            .split('/')[2]
                    )
                }
            }

            const event = {
                name: matchEl.find('.event a').text(),
                id: Number(
                    matchEl
                        .find('.event a')
                        .attr('href')!
                        .split('/')[2]
                )
            }

            const result = matchEl.find('.result').text()

            return {date, map, winner, event, result}
        })
    }

    let highlights: Highlight[] | undefined

    if (team1 && team2) {
        highlights = toArray($('.highlight')).map(highlightEl => ({
            link: highlightEl.attr('data-highlight-embed')!,
            title: highlightEl.text()
        }))
    }

    let statsId: number | undefined

    if ($('.stats-detailed-stats a').length) {
        const matchStatsHref = $('.stats-detailed-stats a').attr('href')!

        statsId =
            matchStatsHref.split('/')[3] !== 'mapstatsid'
                ? parseInt(matchStatsHref.split('/')[3], 10)
                : parseInt(matchStatsHref.split('/')[4], 10)
    }

    const sockets = hasScorebot
        ? $('#scoreboardElement').attr('data-scorebot-url')!.split(',')
        : []

    return {
        id,
        statsId,
        team1,
        team2,
        winnerTeam,
        scores,
        date,
        format,
        additionalInfo,
        event,
        maps,
        players,
        streams,
        live,
        tie,
        status,
        title,
        hasScorebot,
        sockets,
        highlightedPlayer,
        headToHead,
        vetoes,
        highlights,
        demos,
        odds,
        oddsCommunity,
    }
}
