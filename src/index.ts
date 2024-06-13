import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {credential} from "firebase-admin";
import {getStorage} from "firebase-admin/storage";
import applicationDefault = credential.applicationDefault;
import * as fs from "fs";
import axios from "axios";

export const getCustomToken = functions.https.onRequest((request, response) => {
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
});

export const uploadFile = functions.https.onRequest((request, response) => {
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
      fs.writeFileSync("temp.txt", request.rawBody);
      getStorage().bucket("leadme-labs.appspot.com").upload("temp.txt", {
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
});

/**
 * Used by the launcher to upload log files shortly after NUC/Station startup
 */
// eslint-disable-next-line max-len
export const anonymousLogUpload = functions.https.onRequest((request, response) => {
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
  if (!request.header("site") ||
      // eslint-disable-next-line max-len
      !request.header("site")?.match("^[\\s\\da-zA-Z-_']*$")) { // only letters, numbers, single quotes, dashes and underscores
    console.log("rejected at: site");
    response.status(422);
    response.send();
    return;
  }
  if (!request.header("device") ||
      // eslint-disable-next-line max-len
      !request.header("device")?.match("^(NUC|Station)[\\d]{0,3}$")) { // NUC or Station123
    console.log("rejected at: device");
    response.status(422);
    response.send();
    return;
  }
  if (!request.header("fileName") ||
      // eslint-disable-next-line max-len
      !request.header("fileName")?.match("^20\\d\\d_\\d\\d_\\d\\d_log$")) { // match date stamp_log, todo - fix in the year 3000
    console.log("rejected at: fileName");
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

  fs.writeFileSync("tmp/temp.txt", request.rawBody);
  getStorage().bucket("leadme-labs.appspot.com").upload("tmp/temp.txt", {
    destination:
    // eslint-disable-next-line max-len
        `unauthenticatedLogFiles/${request.header("site")}/${request.header("device")}/${request.header("fileName")}.txt`,
  }).then(() => {
    response.status(200);
    response.send();
    return;
  });
});

// eslint-disable-next-line max-len
export const uploadNetworkCheckerReport = functions.https.onRequest((request, response) => {
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
});

export const status = functions.https.onRequest((request, response) => {
  if (request.method !== "GET") {
    response.status(405);
    response.send();
    return;
  }
  response.status(204);
  response.send();
  return;
});

export const submitTicket = functions.https.onRequest((request, response) => {
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
});

const validateEmail = (email: string) => {
  return String(email)
    .toLowerCase()
    .match(
      // eslint-disable-next-line max-len
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
};
