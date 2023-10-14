const fs = require("fs");
const ics = require("ics");
const { program } = require('commander');

function normalizeFilename(filename) {
    return filename.toLowerCase().replace(/[^a-z]+/, '-');
}

function writeEvents(eventList, outputDir, filename) {
    filename = normalizeFilename(filename);
    ics.createEvents(eventList, (err, icsEvents) => {
        if (err) {
            throw err;
        } else {
            fs.writeFileSync(`${outputDir}/${filename}.ics`, icsEvents);
            console.log(`Wrote ${eventList.length} events to ${outputDir}/${filename}.ics`);
        }
    });
}

function loadSessionsByID(sessionsFile) {
    const sessions = JSON.parse(fs.readFileSync(sessionsFile));
    return sessions.data.reduce((a, v) => ({ ...a, [v.scheduleUid]: v}), {});
}

function loadInterests(interestsFile, sessions) {
    const interests = JSON.parse(fs.readFileSync(interestsFile));
    return interests.data.followedSessions.map((interest) => sessions[interest.scheduleUid]);
}

function toIcsDateTime(unixTimeSec) {
    const unixTimeMs = unixTimeSec * 1000;
    const date = new Date(unixTimeMs);
    return [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1, // ICS months are 1-indexed; JavaScript are 0
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
    ];
}

function sessionToIcs(session) {
    const sessionType = session.sessionType;
    const event = {
        start: toIcsDateTime(session.startDateTime),
        startInputType: "utc",
        end: toIcsDateTime(session.endDateTime),
        location: `${session.venueName} - ${session.locationName}`,
        title: `${session.thirdPartyID} - ${session.title}`,
        description: `${sessionType}\n\n${session.description}`,
    };
    return { sessionType, event };
}

function interestsToICS(sessionsFile, interestsFile, options, command) {
    const sessions = loadSessionsByID(sessionsFile);
    const interests = loadInterests(interestsFile, sessions);
    const outputDir = options.outputDir;

    fs.mkdirSync(`./${outputDir}`, {recursive: true});

    const events = {};
    interests.map(sessionToIcs).forEach((session) => {
        if (!events.hasOwnProperty(session.sessionType)) {
            events[session.sessionType] = [];
        }
        events[session.sessionType].push(session.event);
    });

    let allEvents = [];
    for (const eventType in events) {
        allEvents = allEvents.concat(events[eventType]);
        writeEvents(events[eventType], outputDir, `${eventType}s`);
    }
    writeEvents(allEvents, outputDir, 'all-sessions');
}

program
    .name('sessions-to-ics')
    .version('2023.0.0')
    .showHelpAfterError(true)
    .option('-o, --output-dir <dir>', 'the output directory', 'sessions')
    .argument('<sessions>', 'the session catalog')
    .argument('<interests>', 'the interests file')
    .action(interestsToICS)
    .parse();
