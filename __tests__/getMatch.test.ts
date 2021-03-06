import HLTV from '../src/'

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

test('getMatch', async () => {
    expect(await HLTV.getMatch({ id: 2325765 })).toMatchSnapshot()
    expect(await HLTV.getMatch({ id: 2302345 })).toMatchSnapshot()
    await sleep(3000)
    expect(await HLTV.getMatch({ id: 2290099 })).toMatchSnapshot()
    expect(await HLTV.getMatch({ id: 2340931 })).toMatchSnapshot()
    await sleep(1500)
    expect(await HLTV.getMatch({ id: 2331686 })).toMatchSnapshot()
    expect(await HLTV.getMatch({ id: 2335487 })).toMatchSnapshot()
}, 30000)
