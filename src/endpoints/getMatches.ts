import { UpcomingMatch } from '../models/UpcomingMatch'
import { LiveMatch } from '../models/LiveMatch'
import { Event } from '../models/Event'
import { Team } from '../models/Team'
import { MapSlug } from '../enums/MapSlug'
import { popSlashSource, text } from '../utils/parsing'
import { HLTVConfig } from '../config'
import { fetchPage, toArray, getMatchFormatAndMap } from '../utils/mappers'

export const getMatches = (config: HLTVConfig) => async ({
    type = 'all'
} = {}): Promise<(UpcomingMatch | LiveMatch)[]> => {
    const $ = await fetchPage(`${config.hltvUrl}/matches`, config.loadPage)

    const upcomingMatches: UpcomingMatch[] = toArray($('.upcoming-match')).map(matchEl => {
        const link = matchEl.find('.a-reset')
        const id = Number(link.attr('href')!.split('/')[2])
        const date = Number(matchEl.find('div.time').attr('data-unix')) || undefined
        const title = matchEl.find('.placeholder-text-cell').text() || undefined
        const stars = matchEl.find('.stars i').length

        const {map, format} = getMatchFormatAndMap(matchEl.find('.map-text').text())

        let event: Event | undefined
        let team1: Team | undefined
        let team2: Team | undefined

        if (!title) {
            const teams = matchEl.find('img.logo');

            team1 = {
                id: teams.get(0) ? Number(popSlashSource($(teams.first()))) : 0,
                name: matchEl.find('div.team').first().text(),
                logo: teams.get(0) ? teams.first().attr('src') : null
            }

            team2 = {
                id: teams.get(1) ? Number(popSlashSource($(teams.last()))) : 0,
                name: matchEl.find('div.team').last().text(),
                logo: teams.get(1) ? teams.last().attr('src') : null
            }

            event = {
                name: matchEl.find('.event-logo').attr('alt')!,
                id: Number(popSlashSource(matchEl.find('img.event-logo'))!.split('.')[0]) || undefined
            }
        }

        return {id, date, team1, team2, format, map, title, event, stars, live: false}
    })

    if (type === 'onlyUpcoming') {
        return upcomingMatches
    }

    const liveMatches: LiveMatch[] = toArray($('.live-match .a-reset')).map(matchEl => {
        const id = Number(matchEl.attr('href')!.split('/')[2])
        const teamEls = matchEl.find('img.logo')
        const stars = matchEl.find('.stars i').length

        const team1: Team = {
            id: Number(popSlashSource(teamEls.first())) || 0,
            name: teamEls.first().attr('title')!,
            logo: teamEls.first().attr('src')!
        }

        const team2: Team = {
            id: Number(popSlashSource(teamEls.last())) || 0,
            name: teamEls.last().attr('title')!,
            logo: teamEls.last().attr('src')!
        }

        const format = matchEl.find('.bestof').text()
        const maps = toArray(matchEl.find('.header .map')).map(text) as MapSlug[]

        const event: Event = {
            name: matchEl.find('.event-logo').attr('title')!,
            id: Number(popSlashSource(matchEl.find('.event-logo'))!.split('.')[0]) || undefined
        }

        return {id, team1, team2, event, format, maps, stars, live: true}
    })

    if (type === 'onlyLive') {
        return liveMatches
    }

    return [...liveMatches, ...upcomingMatches]
}
