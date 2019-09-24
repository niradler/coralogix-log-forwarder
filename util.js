const zlib = require("zlib");
const rp = require("request-promise");
const _ = require("lodash");

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

const parseEvent = logEvent => {
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

module.exports = {
  parseLogGroup,
  gunzip,
  parseEvent,
  postEventsToCoralogix
};
