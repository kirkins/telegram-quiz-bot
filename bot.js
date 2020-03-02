const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const config = require('./config');
const group = config.group;

let winner, quizData, quizMessageId;
let currentQ = 0;
let quizOn = false;
let answeredWrong = [];
let answers = [];
let scores = {};

let prize = "10,000 HONK";
let sponsor = "@Kirkins - Contact for social media followers or custom bots like this one!";

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(config.telegramKey, {polling: true});

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function sortObject(obj) {
  var arr = [];
  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      arr.push({
        'key': prop,
        'value': obj[prop]
      });
    }
  }
  arr.sort(function(a, b) { return b.value - a.value; });
  return arr; // returns array
}

function getMessage() {
  let message = "🎲 QUIZ TIME 🎲";
  message += "\n\nPrize: " + prize;
  message += "\n\nSponsor: " + sponsor;
  message += "\n\nContact @Kirkins to advertise your store by giving away an item!";
  return message;
}

function gameOver() {
  let message = "🎲 NICE WORK - QUIZ OVER🎲";
  message += "\n\nPrize: " + prize;
  message += "\n\nSponsor: " + sponsor;
  message += "\n\nContact @Kirkins to advertise your store by giving away an item!";
  message += "\n\nScores:";
  let scoreArray = sortObject(scores);
  scoreArray.forEach(u => message += "\n" + u.key + ": " + u.value);
  let opts = {
	  inline_keyboard: [[]],
	  parse_mode: "HTML"
  }
  bot.editMessageText(message, {
    chat_id: group,
    message_id: quizMessageId,
    reply_markup: opts
  });
  quizOn = false;
  scores = {};
  currentQ = 0;
}

function getQuiz() {
  https.get('https://opentdb.com/api.php?amount=100', (res) => {
    quizData = "";
    res.on("data", function(chunk) {
      quizData += chunk;
    });
    res.on("end", function() {
      quizData = JSON.parse(quizData);
      quizData = quizData.results;
    });
  });
}

function setQuestion() {
  let message = "🎲 QUIZ TIME 🎲";
  message += "\n\nQuestion #" + (currentQ + 1) + " of " + (quizData.length);
  message += "\n\n" + quizData[currentQ].question;
  message += "\n\nOut this round: ";
  answeredWrong.forEach(user => message += " @" + user);
  message += "\n\nScores:";
  let scoreArray = sortObject(scores);
  scoreArray.forEach(u => message += "\n" + u.key + ": " + u.value);
  if(answers.length == 0) {
    answers.push([{"text": quizData[currentQ].correct_answer,
                  "callback_data": quizData[currentQ].correct_answer}]);
    quizData[currentQ].incorrect_answers.forEach(function (q, i) {
      answers.push([{"text": q, "callback_data": q}]);
    });
    shuffleArray(answers);
  }
  let opts = {
	  inline_keyboard: answers,
	  parse_mode: "HTML"
  }
  bot.editMessageText(message, {
    chat_id: group,
    message_id: quizMessageId,
    reply_markup: opts
  });
}

function checkAnswer(res) {
  if(res.data == quizData[currentQ].correct_answer) {
    if(res.from.username in scores) {
      scores[res.from.username] = scores[res.from.username] + 1;
    } else {
      scores[res.from.username] = 1;
    }
    answeredWrong = [];
    answers = [];
    currentQ++;
    if(currentQ+1 >= quizData.length) {
      gameOver();
    } else {
      setQuestion();
    }
  } else {
    answeredWrong.push(res.from.username);
    answeredWrong = answeredWrong.filter((v, i, a) => a.indexOf(v) === i);
    bot.answerCallbackQuery(res.id);
    setQuestion();
  }
}

bot.onText(/\/quiz/, (msg, match) => {
  bot.deleteMessage(group, msg.message_id);
  let quiz = getQuiz();
  
  if(msg.from.id == config.master && !quizOn) {
    console.log("yes");
    quizOn = true;
    winner = null;
    let message = getMessage();
    let opts = {
      "reply_markup": {
        inline_keyboard: [[
          {
            "text": "Start",
            "callback_data": "start"
          }
        ]]
      }
    }
    bot.sendMessage(group, message, opts, function (isSuccess) {
      console.log(isSuccess);
    });
  }
});

bot.onText(/\/repost/, (msg, match) => {
  bot.deleteMessage(group, msg.message_id);
  if(msg.from.id == config.master) {
    bot.deleteMessage(group, quizMessageId);
    let message = getMessage();
    let opts = {
      "reply_markup": {
        inline_keyboard: [[
          {
            "text": "Resume Quiz",
            "callback_data": "start"
          }
        ]]
      }
    }
    bot.sendMessage(group, message, opts, function (isSuccess) {
      console.log(isSuccess);
    });
  }
});

bot.onText(/\/skip/, (msg, match) => {
  bot.deleteMessage(group, msg.message_id);
  if(msg.from.id == config.master) {
    answeredWrong = [];
    answers = [];
    currentQ++;
    if(currentQ+1 >= quizData.length) {
      gameOver();
    } else {
      setQuestion();
    }
  }
});
bot.on('callback_query', function onCallbackQuery(callbackQuery) {
  if(callbackQuery.data =="start") {
    quizMessageId = callbackQuery.message.message_id;
    setQuestion();
  } else {
    if(!answeredWrong.includes(callbackQuery.from.username)) {
      checkAnswer(callbackQuery);
    }
  }
});

bot.on('message', (msg) => {
  console.dir(msg);
});
