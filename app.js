const express = require("express");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

let db = null;

const initializeDbAndSaver = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running on http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Error Message ${e.message}`);
  }
};
initializeDbAndSaver();

/*const latestTwee = (each) => {
  return {
    username: each.username,
    tweet: each.tweet,
    dateTime: each.date_time,
  };
};*/

const AuthenticationWithToken = (request, response, next) => {
  let jwAccess;
  const userHeader = request.headers["authorization"];
  if (userHeader !== undefined) {
    jwAccess = userHeader.split(" ")[1];
  }
  if (jwAccess === undefined) {
    console.log("first");
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwAccess, "huwbegopwr89nbvjei90", async (error, payLoad) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payLoad.username;
        next();
      }
    });
  }
};

// creating user
app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);

  const userNameQuery = `
    SELECT 
        DISTINCT(name)
    FROM
        user
    WHERE 
        username = '${username}';`;

  const userInformation = await db.get(userNameQuery);
  const len = `${password.length}`;

  if (userInformation === undefined) {
    const creatingNewUser = `
            INSERT INTO
                user(username ,password , name, gender)
            VALUES
                ('${username}','${hashedPassword}','${name}','${gender}');

            `;
    if (len < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const NewUser = await db.run(creatingNewUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const verifyingUser = `
    SELECT *
    FROM
        user
    WHERE
        username = '${username}'; 
    `;
  const user = await db.get(verifyingUser);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (isPasswordMatch === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "huwbegopwr89nbvjei90");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get(
  "/user/tweets/feed/",
  AuthenticationWithToken,
  async (request, response) => {
    const { username } = request;
    const userDetails = `SELECT * FROM user WHERE username = '${username}';`;
    const user = await db.get(userDetails);
    const followersDetails = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user.user_id};`;
    const follower = await db.all(followersDetails);
    const tweetDetails = follower.map((each) => {
      return each["following_user_id"];
    });
    const tweetInfo = `SELECT user.username AS username,tweet.tweet AS tweet,tweet.date_time AS dateTime
    FROM user JOIN tweet ON user.user_id = tweet.user_id WHERE tweet.user_id IN (${tweetDetails})
    ORDER BY tweet.date_time DESC LIMIT 4;`;
    const tweetRes = await db.all(tweetInfo);
    response.send(tweetRes);
  }
);

//post
app.post(
  "/user/tweets/",
  AuthenticationWithToken,
  async (request, response) => {
    const { username } = request;
    const { tweet } = request.body;
    const currentUser = `
    SELECT * FROM user WHERE username = '${username}';`;
    const details = await db.get(currentUser);
    let date = new Date();
    let stringId = details.user_id;
    console.log(typeof stringId);
    const createTweet = `
    INSERT INTO 
        tweet (tweet,user_id,date_time)
    VALUES('${tweet}',${stringId},'${date}');`;
    const tweeted = await db.run(createTweet);
    response.send("Created a Tweet");
  }
);

//delete
app.delete(
  "/tweets/:tweetId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const tweetNum = `
    SELECT *
    FROM
        user INNER JOIN tweet ON user.user_id = tweet.user_id
    WHERE username = '${username}';
        `;
    const tweetLink = await db.get(tweetNum);
    let tweetMainId = tweetLink.tweet_id;

    if (tweetId != tweetMainId) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const tweetRE = `
        DELETE 
        FROM
            tweet
        WHERE 
            tweet_id = ${tweetId};
    `;
      await db.run(tweetRE);
      response.send("Tweet Removed");
    }
  }
);

app.get(
  "/user/following/",
  AuthenticationWithToken,
  async (request, response) => {
    const { username } = request;
    const userDetails = `
    SELECT * FROM user WHERE username = '${username}'`;
    const details = await db.get(userDetails);
    const following = `SELECT * FROM follower WHERE follower_user_id =${details.user_id};`;
    const followerDetails = await db.all(following);
    let result = [];
    for (let i in followerDetails) {
      let z = followerDetails[i];
      let fds = `SELECT name FROM user WHERE user_id = ${z.following_user_id}`;
      let vfs = await db.get(fds);
      result.push(vfs);
    }
    response.send(result);
    console.log(result);
  }
);

app.get(
  "/user/followers/",
  AuthenticationWithToken,
  async (request, response) => {
    const { username } = request;
    const userDetails = `
    SELECT * FROM user WHERE username = '${username}';`;
    const user = await db.get(userDetails);
    const followers = `SELECT * FROM follower WHERE following_user_id = ${user.user_id};`;
    const followingDetails = await db.all(followers);
    let result = [];
    for (let i in followingDetails) {
      let firstArray = followingDetails[i];
      let sqliteQuery = `SELECT name FROM user WHERE user_id = ${firstArray.follower_user_id};`;
      let queryResult = await db.get(sqliteQuery);
      result.push(queryResult);
    }
    response.send(result);
  }
);

app.get(
  "/tweets/:tweetId/",
  AuthenticationWithToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const { username } = request;
    const userDetails = `
    SELECT * FROM user WHERE username = '${username}';`;
    const user = await db.get(userDetails);

    const tweetQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetInfo = await db.get(tweetQuery);
    //console.log(tweetInfo);
    const followersDetails = `SELECT following_user_id FROM follower WHERE follower_user_id = ${user.user_id};`;
    const follower = await db.all(followersDetails);
    const tweetDetails = follower.map((each) => {
      return each["following_user_id"];
    });

    if (!tweetDetails.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, dateTime, tweet } = tweetInfo;
      const likesQuery = `SELECT COUNT(like_id) AS likes FROM like 
        WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;`;
      const likeInfo = await db.get(likesQuery);
      const replyQuery = `SELECT COUNT(reply_id) AS replies FROM reply 
        WHERE tweet_id = ${tweet_id} GROUP BY tweet_id;`;
      const replyInfo = await db.get(replyQuery);
      response.send({
        tweet,
        like: likeInfo.likes,
        replies: replyInfo.replies,
        dateTime: dateTime,
      });
    }
  }
);

app.get("/user/tweets/", AuthenticationWithToken, async (request, response) => {
  const { username } = request;
  const userDetails = `
    SELECT *
    FROM user 
    WHERE username = '${username}'  `;
  const details = await db.get(userDetails);
  const tweetQuery = `SELECT * FROM tweet WHERE user_id = ${details.user_id} ORDER BY tweet_id`;
  const tweetDetails = await db.all(tweetQuery);
  const tweetIdList = tweetDetails.map((each) => {
    return each.tweet_id;
  });
  const getLikeQuery = `SELECT COUNT(like_id) AS likes FROM like WHERE tweet_id IN (${tweetIdList})
  GROUP BY tweet_id ORDER BY tweet_id;`;
  const likeObjects = await db.all(getLikeQuery);
  const getRepliesQuery = `SELECT COUNT(reply_id) AS replies FROM reply
  WHERE tweet_id IN (${tweetIdList}) GROUP BY tweet_id ORDER BY tweet_id;`;
  const replyObject = await db.all(getRepliesQuery);

  response.send(
    tweetDetails.map((tweetObj, index) => {
      const likes = likeObjects[index] ? likeObjects[index].likes : 0;
      const replies = replyObject[index] ? replyObject[index].replies : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

const followerDetails = (each) => {
  return {
    name: each.name,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  AuthenticationWithToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const userDetails = `
    SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(userDetails);
    const tweetQuery = `SELECT *
                          FROM tweet 
                          WHERE tweet_id = ${tweetId};`;
    const tweetDetails = await db.get(tweetQuery);

    const followingUserQuery = `
    SELECT following_user_id from follower WHERE follower_user_id = ${dbUser.user_id};`;
    const followingUserObject = await db.all(followingUserQuery);
    const followingUserList = followingUserObject.map((each) => {
      return each["following_user_id"];
    });
    console.log(tweetDetails);
    if (!followingUserList.includes(tweetDetails.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetDetails;
      const getLikeQuery = `SELECT user_id FROM like WHERE tweet_id = ${tweet_id}`;
      const likedUserObjects = await db.all(getLikeQuery);
      const likedUserIdList = likedUserObjects.map((eachObject) => {
        return eachObject.username;
      });
      response.send({
        likes: likedUserIdList,
      });
    }
  }
);

module.exports = app;
