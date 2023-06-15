import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {credential} from "firebase-admin";
import applicationDefault = credential.applicationDefault;

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
