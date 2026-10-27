import dayjs from 'dayjs'
import type { MonitorTimeRange } from '../types'

/** Preserve traffic buckets; the backend also parses their formatted keys back into timestamps. */
export const networkParams = (val: { time: { time: MonitorTimeRange } }) => {
    let _time = '1h';
    let _limit = 12;
    // Joda defaults a missing year to 2000, so transport keys must carry the full calendar date.
    let format = 'yyyy-MM-dd HH:mm';
    const dt = val.time.time[1].valueOf() - val.time.time[0].valueOf()
    const hour = 60 * 60 * 1000;
    const days = hour * 24;
    const months = days * 30;
    const year = 365 * days;

    if (dt <= (hour + 10)) {
        _time = '1m';
        _limit = 60;
    } else if (dt > hour && dt <= days) {
        _limit = 24;
    } else if (dt > days && dt <= months * 3) {
        _limit = Math.abs(Math.ceil(dt / days)) + 1;
        _time = '1d';
        format = 'yyyy-MM-dd';
    } else if (dt > months * 3 && dt < year) {
        _limit = Math.abs(Math.ceil(dt / months)) + 1;
        _time = '1M';
        format = 'yyyy-MM';
    } else if (dt >= year) {
        _limit = Math.abs(Math.floor(dt / months));
        _time = '1M';
        format = 'yyyy-MM';
    }
    return ['bytesRead', 'bytesSent'].map(type => ({
            dashboard: 'systemMonitor',
            object: 'network',
            measurement: 'traffic',
            dimension: 'agg',
            group: type,
            params: {
                type,
                interval: _time,
                from: Number(val.time.time[0]),
                to: Number(val.time.time[1]),
                limit: _limit,
                format: format,
            },
        }));
};
export const defaultParamsData = (group: string, val: { time: MonitorTimeRange }) => [
    {
        dashboard: 'systemMonitor',
        object: 'stats',
        measurement: 'info',
        dimension: 'history',
        group: group.startsWith('cpu') ? 'cpu' : 'memory',
        params: {
            from: dayjs(val.time[0]).valueOf(),
            to: dayjs(val.time[1]).valueOf(),
            format: 'YYYY-MM-dd HH:mm',
        },
    },
];

export const networkHistoryParams = (val: { time: MonitorTimeRange }) => [
    {
        dashboard: 'systemMonitor',
        object: 'stats',
        measurement: 'info',
        dimension: 'history',
        group: 'network',
        params: {
            from: dayjs(val.time[0]).valueOf(),
            to: dayjs(val.time[1]).valueOf(),
            format: 'YYYY-MM-dd HH:mm',
        },
    },
];
