"use strict";

const zlib = require("zlib");
const rp = require("request-promise");
const _ = require("lodash");
const appName = process.env.app_name ? process.env.app_name : "NO_APPLICATION";
const subName = process.env.sub_name ? process.env.sub_name : "NO_SUBSYSTEM"; // ?

const retries = 3;

const postEventsToCoralogix = body => {
  var options = {
    method: "POST",
    uri: "https://api.coralogix.com/api/v1/logs",
    body,
    json: true,
    headers: {
      "Content-Type": "application/json"
    }
  };

  return rp(options);
};

const getSeverityLevel = message => {
  var severity = 3;

  if (message.includes("debug")) severity = 1;
  if (message.includes("verbose")) severity = 2;
  if (message.includes("info")) severity = 3;
  if (message.includes("warn") || message.includes("warning")) severity = 4;
  if (message.includes("error")) severity = 5;
  if (message.includes("critical") || message.includes("panic")) severity = 6;

  return severity;
};

const parseEvent = (logEvent, logGroupName, logStreamName) => {
  return {
    timestamp: logEvent.timestamp,
    severity: getSeverityLevel(JSON.stringify(logEvent.message.toLowerCase())),
    text: logEvent.message
  };
};

const gunzip = payload => {
  return new Promise((resolve, reject) => {
    zlib.gunzip(payload, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

const parseLogGroup = logGroup => {
  const [provider, service, name] = logGroup.split("/").filter(t => t);

  return {
    provider,
    service,
    name
  };
};

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
