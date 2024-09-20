/* eslint max-len: "off" */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {credential} from "firebase-admin";
import {getStorage} from "firebase-admin/storage";
import * as fs from "fs";
import axios from "axios";
import * as Sentry from "@sentry/google-cloud-serverless";
import applicationDefault = credential.applicationDefault;

Sentry.init({
  dsn: "https://33575138280beb62232f4c7111bd21a7@o1294571.ingest.us.sentry.io/4507485158834176",
});

const siteNameList: string[] = [
  "ABHS",
  "ABHS_Station_1",
  "ABHS_Station_2",
  "ABHS_Station_3",
  "Adelaide High School",
  "AldingaPayinthi",
  "Ardrossan",
  "Australian Christian College",
  "Australian Science and Mathematics School",
  "AustralianChristianCollege",
  "Canary Test Lab",
  "Catholic Ladies",
  "Catholic Ladies College Eltham",
  "Ceduna",
  "Ceduna Area School",
  "Chevalier College",
  "Darragh's Computer",
  "Dorchester",
  "Dorchester School",
  "Ed's  Computer",
  "Ed's Computer",
  "Emmaus College",
  "Endeavour College",
  "Girton Grammar School",
  "Goolwa Secondary College",
  "Grange School",
  "GrangeNuc",
  "Grange_High_School_South_Australia",
  "Holroyd",
  "Holroyd High School",
  "Kidman Park Primary School",
  "Loreto College",
  "Lumination Melbourne Office",
  "Lyndale",
  "Lyndale Secondary College",
  "Morialta Secondary College",
  "Morialta Seconday College",
  "Norwood",
  "Oz Minerals",
  "Paralowie R-12 School",
  "Peterborough High School",
  "Port Lincoln High School",
  "Production Lab",
  "Snowy Hydro",
  "Snowy Hydro Immersive Theater",
  "Snowy Hydro Immersive Theatre",
  "St Francis",
  "StJosephsCollege",
  "Sydney",
  "Testing",
  "Thebarton",
  "Thebarton - Warehouse",
  "Thebarton Test Lab",
  "Thebarton Warehouse",
  "Therbarton Warehouse",
  "Underdale",
  "Unknown",
  "Whyalla Secondary College",
  "Willunga High School",
  "acc",
  "aldinga",
  "lyndale secondary college",
  "norwood",
];

export const getCustomToken = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!JSON.parse(request.body).uid) {
    response.status(422);
    response.send();
    return;
  }
  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }
  const uid = JSON.parse(request.body).uid;

  response.header("Access-Control-Allow-Origin", "*");
  admin.auth().verifyIdToken(JSON.parse(request.body).token).then((result) => {
    if (result.firebase.sign_in_provider !== "email" &&
        result.firebase.sign_in_provider !== "password") {
      response.status(401);
      response.send();
      return;
    }
    admin.auth().getUser(uid).then(() => {
      response.status(409);
      response.send("UID is already in use");
      return;
    }).catch((reason) => {
      if (reason.code === "auth/user-not-found") {
        admin.auth().createCustomToken(uid)
          .then(function(customToken) {
            console.log(customToken.toString);
            response.send(customToken);
          })
          .catch(function(error) {
            console.log("Error creating custom token:", error);
          });
      } else {
        response.status(400);
        response.send();
        return;
      }
      console.log("reason", reason);
    });
  }).catch(() => {
    response.status(401);
    response.send();
    return;
  });
}));

export const uploadFile = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Authorization")) {
    response.status(401);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      request.header("Content-Type") !== "text/plain") {
    response.status(422);
    response.send();
    return;
  }
  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  response.header("Access-Control-Allow-Origin", "*");

  admin.auth()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    .verifyIdToken(request.header("Authorization")
      .replace("Bearer ", ""))
    .then((result) => {
      fs.writeFileSync("/tmp/temp.txt", request.rawBody);
      getStorage().bucket("leadme-labs.appspot.com").upload("/tmp/temp.txt", {
        destination:
            `autoLogFiles/${result.uid}/log${Date.now().toString()}.txt`,
      }).then(() => {
        response.status(200);
        response.send();
        return;
      });
    }).catch((error) => {
      console.log(error);
      response.status(401);
      response.send();
      return;
    });
}));

export const simpleQaUpload = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header("Access-Control-Allow-Headers", "Access-Control-Allow-Origin, Content-Type, SiteName");

  if (request.method === "OPTIONS") {
    response.status(200);
    response.send();
    return;
  }
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      request.header("Content-Type") !== "text/plain") {
    console.log("rejected at: Content-Type");
    response.status(422);
    response.send();
    return;
  }
  const site: string = request.header("SiteName") ?? "";
  if (site === "") { // only letters, numbers, single quotes, dashes and underscores
    console.log("rejected at: site");
    response.status(422);
    response.send();
    return;
  }

  const currDay = new Date();
  const fileName = `${currDay.getFullYear()}_${((currDay.getMonth() + 1) + "").padStart(2, "0")}_${((currDay.getDate()) + "").padStart(2, "0")}_qa`;


  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  fs.writeFileSync("/tmp/temp.json", request.rawBody);
  const bucket = getStorage().bucket("leadme-labs.appspot.com");

  bucket.upload("/tmp/temp.json", {
    destination:
        `simpleQa/${site}/${fileName}.json`,
  }).then(() => {
    response.status(200);
    response.send();
    return;
  }).catch((e) => {
    response.status(400);
    response.send();
    return;
  });
}));

/**
 * Used by the launcher to upload log files shortly after NUC/Station startup
 */
export const anonymousLogUpload = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      request.header("Content-Type") !== "text/plain") {
    console.log("rejected at: Content-Type");
    response.status(422);
    response.send();
    return;
  }
  const site: string = request.header("site") ?? "";
  if (site === "" ||
      !request.header("site")?.match("^[\\s\\da-zA-Z-_']*$")) { // only letters, numbers, single quotes, dashes and underscores
    console.log("rejected at: site");
    response.status(422);
    response.send();
    return;
  }

  if (!siteNameList.includes(site)) {
    Sentry.captureMessage("Unlisted site log file for site: " + site);
    response.status(422);
    response.send();
    return;
  }

  if (!request.header("device") ||
      !request.header("device")?.match("^(NUC|Station)[\\d]{0,3}$")) { // NUC or Station123
    console.log("rejected at: device");
    response.status(422);
    response.send();
    return;
  }
  if (!request.header("fileName") ||
      !request.header("fileName")?.match("^20\\d\\d_\\d\\d_\\d\\d_log$")) { // match date stamp_log, todo - fix in the year 3000
    console.log("rejected at: fileName");
    response.status(422);
    response.send();
    return;
  }

  // validate that it is only today's file (we'll allow +/- one day for timezones)
  const currDay = new Date();
  const prevDay = new Date();
  prevDay.setDate(currDay.getDate() - 1);
  const nextDay = new Date();
  nextDay.setDate(currDay.getDate() + 1);
  const acceptableFileNames = [ // have today and yesterday to reduce dealing with timezones
    `${prevDay.getFullYear()}_${((prevDay.getMonth() + 1) + "").padStart(2, "0")}_${((prevDay.getDate()) + "").padStart(2, "0")}_log`,
    `${currDay.getFullYear()}_${((currDay.getMonth() + 1) + "").padStart(2, "0")}_${((currDay.getDate()) + "").padStart(2, "0")}_log`,
    // `${nextDay.getFullYear()}_${((nextDay.getMonth() + 1) + "").padStart(2, "0")}_${((nextDay.getDate()) + "").padStart(2, "0")}_log`,
  ];
  if (!acceptableFileNames.includes(<string>request.header("fileName"))) {
    console.log("rejected at: fileName days");
    response.status(422);
    response.send();
    return;
  }

  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  response.header("Access-Control-Allow-Origin", "*");

  fs.writeFileSync("/tmp/temp.txt", request.rawBody);
  const bucket = getStorage().bucket("leadme-labs.appspot.com");
  bucket
    .file(`unauthenticatedLogFiles/${request.header("site")}/${request.header("device")}/${request.header("fileName")}.txt`)
    .getMetadata()
    .then(() => {
      // already uploaded that days file
      response.status(200);
      response.send();
      return;
    }).catch((e) => {
      if (e.code === 404) {
        bucket.upload("/tmp/temp.txt", {
          destination:
              `unauthenticatedLogFiles/${request.header("site")}/${request.header("device")}/${request.header("fileName")}.txt`,
        }).then(() => {
          response.status(200);
          response.send();
          return;
        });
      } else {
        response.status(400);
        response.send();
        return;
      }
    });
}));

export const checkForCachedImages = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      !request.header("Content-Type")?.includes("application/json")) {
    console.log("rejected at: Content-Type");
    response.status(422);
    response.send();
    return;
  }
  const site: string = request.header("site") ?? "";
  if (site === "" ||
      !request.header("site")?.match("^[\\s\\da-zA-Z-_']*$")) { // only letters, numbers, single quotes, dashes and underscores
    console.log("rejected at: site");
    response.status(422);
    response.send();
    return;
  }

  if (!siteNameList.includes(site)) {
    Sentry.captureMessage("Unlisted site image check for site: " + site);
    response.status(422);
    response.send();
    return;
  }

  if (!request.header("device") ||
      !request.header("device")?.match("^(NUC|Station)[\\d]{0,3}$")) { // NUC or Station123
    console.log("rejected at: device");
    response.status(422);
    response.send();
    return;
  }

  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  response.header("Access-Control-Allow-Origin", "*");

  const bucket = getStorage().bucket("leadme-labs.appspot.com");
  bucket.getFiles({
    prefix: "applicationImages",
  }).then((result) => {
    console.log(result);

    const names = result[0].map((element) => {
      return element.name.replace("applicationImages/", "");
    });
    const missingImages = request.body.names.filter((el: string) => !names.includes(el));

    console.log(missingImages);

    response.status(200);
    response.send(missingImages);
  });
}));

export const uploadApplicationImage = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      !request.header("Content-Type")?.includes("image/jpeg")) {
    console.log("rejected at: Content-Type");
    console.log(request.header("Content-Type"));
    response.status(422);
    response.send();
    return;
  }
  const site: string = request.header("site") ?? "";
  if (site === "" ||
      !request.header("site")?.match("^[\\s\\da-zA-Z-_']*$")) { // only letters, numbers, single quotes, dashes and underscores
    console.log("rejected at: site");
    response.status(422);
    response.send();
    return;
  }

  if (!siteNameList.includes(site)) {
    Sentry.captureMessage("Unlisted site image upload for site: " + site);
    response.status(422);
    response.send();
    return;
  }

  if (!request.header("device") ||
      !request.header("device")?.match("^(NUC|Station)[\\d]{0,3}$")) { // NUC or Station123
    console.log("rejected at: device");
    response.status(422);
    response.send();
    return;
  }
  if (!request.header("filename")) {
    console.log("rejected at: filename");
    console.log(request.header("filename"));
    response.status(422);
    response.send();
    return;
  }

  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  response.header("Access-Control-Allow-Origin", "*");

  const fileName = "/tmp/" + request.header("filename");
  fs.writeFileSync(fileName, request.rawBody);

  const bucket = getStorage().bucket("leadme-labs.appspot.com");
  bucket.upload(fileName, {
    destination:
        `applicationImages/${request.header("filename")}`,
  }).then(() => {
    response.status(200);
    response.send();
    return;
  });
}));

export const uploadNetworkCheckerReport = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.header("Content-Type") ||
      request.header("Content-Type") !== "application/pdf") {
    response.status(422);
    response.send();
    return;
  }

  if (!request.header("SiteName")) {
    response.status(422);
    response.send();
    return;
  }

  if (!request.header("Email") ||
  !validateEmail(request.header("Email") ?? "")) {
    response.status(422);
    response.send();
    return;
  }

  response.header("Access-Control-Allow-Origin", "*");

  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  const sitename = request.header("SiteName")
    ?.replace(/\s/g, "")
    .replace(/\W/g, "");

  fs.writeFileSync("/tmp/temp.pdf", request.rawBody);
  getStorage().bucket("leadme-labs.appspot.com").upload("/tmp/temp.pdf", {
    destination:
    `networkReports/${sitename}-${Date.now().toString()}.pdf`,
    metadata: {
      customMetadata: {
        "email": request.header("Email"),
      },
    },
  }).then(() => {
    response.status(200);
    response.send();
    return;
  });
}));

export const status = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.status(405);
    response.send();
    return;
  }
  response.status(204);
  response.send();
  return;
}));

export const submitTicket = Sentry.wrapHttpFunction(functions.https.onRequest((request, response) => {
  if (request.method !== "POST") {
    response.status(405);
    response.send();
    return;
  }
  if (!request.body.subject ||
      !request.body.email ||
      !request.body.content) {
    response.status(422);
    response.send();
    return;
  }

  if (admin.apps.length < 1) {
    admin.initializeApp({
      credential: applicationDefault(),
    });
  }

  response.header("Access-Control-Allow-Origin", "*");

  axios.post("https://api.hubapi.com/crm/v3/objects/tickets", {
    "properties": {
      "hs_pipeline": 0,
      "hs_pipeline_stage": 1,
      "hs_ticket_priority": "MEDIUM",
      "subject": request.body.subject,
      "content": `Ticket from ${request.body.email}\n${request.body.content}`,
    },
  }, {
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
    },
  }).then(() => {
    response.status(201);
    response.send();
    return;
  }).catch((error) => {
    console.log(error);
    response.status(400);
    response.send();
    return;
  });
}));

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};
