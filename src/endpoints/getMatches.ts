import { UpcomingMatch } from '../models/UpcomingMatch'
import { LiveMatch } from '../models/LiveMatch'
import { Event } from '../models/Event'
import { Team } from '../models/Team'
import { MapSlug } from '..'
import { popSlashSource } from '../utils/parsing'
import { HLTVConfig } from '../config'
import { fetchPage, toArray, getMatchFormatAndMap, getMatchFormat } from '../utils/mappers'

export const getMatches = (config: HLTVConfig) => async ({
    type = 'all'
} = {}): Promise<(UpcomingMatch | LiveMatch)[]> => {
    const $ = await fetchPage(`${config.hltvUrl}/matches`, config.loadPage)

    const upcomingMatches: UpcomingMatch[] = toArray($('.upcomingMatch')).map(matchEl => {
        const link = matchEl.find('.a-reset')
        const id = Number(link.attr('href')!.split('/')[2])

        const date = Number(matchEl.find('div.matchTime').attr('data-unix')) || undefined
        const title = matchEl.find('.matchInfoEmpty').text() || undefined
        const stars = matchEl.find('.matchRating i').length

        const { map, format } = getMatchFormatAndMap(matchEl.find('.matchMeta').text())

        let event: Event | undefined
        let team1: Team | undefined
        let team2: Team | undefined

        if (!title) {
            const teams = matchEl.find('img.matchTeamLogo');

            team1 = {
                id: teams.get(0) ? Number(popSlashSource($(teams.first()))) : 0,
                name: matchEl.find('div.matchTeamName').first().text(),
                logo: teams.get(0) ? teams.first().attr('src') : null
            }

            team2 = {
                id: teams.get(1) ? Number(popSlashSource($(teams.last()))) : 0,
                name: matchEl.find('div.matchTeamName').last().text(),
                logo: teams.get(1) ? teams.last().attr('src') : null
            }

            event = {
                name: matchEl.find('.matchEventLogo').attr('alt')!,
                id: Number(popSlashSource(matchEl.find('img.matchEventLogo'))!.split('.')[0]) || undefined
            }
        } else {
            team1 = team2 = {
                id: 0,
                name: 'TBD',
                logo: null
            }
        }

        return { id, date, team1, team2, format, map, title, event, stars, live: false }
    })

    if (type === 'onlyUpcoming') {
        return upcomingMatches
    }

    const liveMatches: LiveMatch[] = toArray($('.liveMatches .liveMatch-container')).map(matchEl => {
        const id = Number(matchEl.attr('data-scorebot-id'))
        const stars = Number(matchEl.attr('stars'))

        const teamEls = matchEl.find('img.matchTeamLogo')

        const team1: Team = {
            id: Number(matchEl.attr('data-team1-id')) || 0,
            name: teamEls.first().attr('title')!,
            logo: teamEls.first().attr('src')!
        }

        const team2: Team = {
            id: Number(matchEl.attr('data-team2-id')) || 0,
            name: teamEls.last().attr('title')!,
            logo: teamEls.last().attr('src')!
        }

        const format = getMatchFormat(matchEl.find('.matchMeta').text())
        const maps = matchEl.attr('data-maps')?.split(',') as MapSlug[] //.map(map => map)

        const event: Event = {
            name: matchEl.find('.matchEventLogo').attr('title')!,
            id: Number(popSlashSource(matchEl.find('.matchEventLogo'))!.split('.')[0]) || undefined
        }

        return { id, team1, team2, event, format, maps, stars, live: true }
    })

    if (type === 'onlyLive') {
        return liveMatches
    }

    return [...liveMatches, ...upcomingMatches]
}
