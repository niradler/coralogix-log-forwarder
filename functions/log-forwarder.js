"use strict";

const {
  parseLogGroup,
  gunzip,
  parseEvent,
  postEventsToCoralogix
} = require("../util");

const appName = process.env.app_name ? process.env.app_name : "NO_APPLICATION";
const subName = process.env.sub_name ? process.env.sub_name : "NO_SUBSYSTEM"; // ?
const retries = 3;

exports.handler = async event => {
  try {
    if (!event.awslog) throw new Error("awslogs is missing.");

    const payload = new Buffer(event.awslogs.data, "base64");
    const resultRaw = await gunzip(payload);
    const resultParsed = JSON.parse(resultRaw.toString("ascii"));
    const groupLines = _.groupBy(
      resultParsed.logEvents,
      line => line.timestamp
    );
    const parsedEvents = _.map(groupLines, (events, id) => {
      const event = {
        ...events[0],
        message: events.map(e => e.message).join()
      };
      return parseEvent(event, resultParsed.logGroup, resultParsed.logStream);
    });

    const parsedLogGroup = parseLogGroup(resultParsed.logGroup);
    const logs = {
      privateKey: process.env.private_key,
      applicationName: appName || parsedLogGroup.service,
      subsystemName: parsedLogGroup.name,
      logEntries: parsedEvents
    };
    let numOfRetries = 0;
    let success = false;
    while (numOfRetries < retries) {
      const res = await postEventsToCoralogix(logs).catch(e => {
        console.error(e);
        numOfRetries++;
      });
      if (res) {
        success = res;
        console.log(res);
        break;
      }
    }

    return success;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
