import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {credential} from "firebase-admin";
import {getStorage} from "firebase-admin/storage";
import applicationDefault = credential.applicationDefault;
import * as fs from "fs";

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
    admin.auth().getUser(uid).then((user) => {
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
    response.status(422);
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
