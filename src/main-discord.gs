const fs = require('fs');
const https = require('https');

console.log('Reading /etc/secrets and /etc/config');

const profiles = [
  { 
    token: fs.readFileSync('/etc/secrets/token', 'utf8').trim(), 
    genshin: (fs.readFileSync('/etc/config/genshin', 'utf8').trim()) === 'true', 
    honkai_star_rail: (fs.readFileSync('/etc/config/honkai_star_rail', 'utf8').trim()) === 'true', 
    honkai_3: (fs.readFileSync('/etc/config/honkai_3', 'utf8').trim()) === 'true', 
    accountName: fs.readFileSync('/etc/secrets/accountName', 'utf8').trim()
  }
];

const discord_notify = (fs.readFileSync('/etc/config/discord_notify', 'utf8').trim()) === 'true';
const myDiscordID = fs.readFileSync('/etc/secrets/myDiscordID', 'utf8').trim();
const discordWebhook = fs.readFileSync('/etc/secrets/discordWebhook', 'utf8').trim();

/** The above is the config. Please refer to the instructions on https://github.com/canaria3406/hoyolab-auto-sign for configuration. **/
/** The following is the script code. Please DO NOT modify. **/

const urlDict = {
  Genshin: 'https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481',
  Star_Rail: 'https://sg-public-api.hoyolab.com/event/luna/os/sign?lang=en-us&act_id=e202303301540311',
  Honkai_3: 'https://sg-public-api.hoyolab.com/event/mani/sign?lang=en-us&act_id=e202110291205111'
}

async function main() {
  const messages = await Promise.all(profiles.map(autoSignFunction));
  const hoyolabResp = `${messages.join('\n\n')}`
  
  if(discord_notify == true){
    if(discordWebhook) {
      postWebhook(hoyolabResp);
    }
  }
}

function discordPing() {
  if(myDiscordID) {
    return `<@${myDiscordID}> `;
  } else {
    return '';
  }
}

function httpRequest(url, options, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function autoSignFunction({ token, genshin, honkai_star_rail, honkai_3, accountName }) {
  const urls = [];

  if (genshin) urls.push(urlDict.Genshin);
  if (honkai_star_rail) urls.push(urlDict.Star_Rail);
  if (honkai_3) urls.push(urlDict.Honkai_3);

  const options = {
    method: 'POST',
    headers: {
      Cookie: token,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'x-rpc-app_version': '2.34.1',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      'x-rpc-client_type': '4',
      'Referer': 'https://act.hoyolab.com/',
      'Origin': 'https://act.hoyolab.com'
    }
  };

  let response = `Check-in completed for ${accountName}`;

  console.log('autosigning')
  const httpResponses = await Promise.all(urls.map(url => httpRequest(url, options)));

  for (const [i, hoyolabResponse] of httpResponses.entries()) {
    const checkInResult = JSON.parse(hoyolabResponse).message;
    const gameName = Object.keys(urlDict).find(key => urlDict[key] === urls[i])?.replace(/_/g, ' ');
    const isError = checkInResult != "OK";
    const bannedCheck = JSON.parse(hoyolabResponse).data?.gt_result?.is_risk;
    if(bannedCheck){
      response += `\n${gameName}: ${discordPing()} Auto check-in failed due to CAPTCHA blocking.`;
    }
    else{
      response += `\n${gameName}: ${isError ? discordPing() : ""}${checkInResult}`;
    }
  };
  console.log(response)
  return response;
}

async function postWebhook(data, retries = 5) {
  let payload = JSON.stringify({
    'username': 'auto-sign',
    'avatar_url': 'https://i.imgur.com/LI1D4hP.png',
    'content': data
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    }
  };
  
  console.log('notifying discord')
  try {
    await httpRequest(discordWebhook, options, payload);
  } catch (error) {
    console.error(`Failed to send webhook: ${error}`);
    if (retries > 0) {
      console.log(`Retrying... (${retries} retries left)`);
      // Wait for 1 second before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      await postWebhook(data, retries - 1);
    } else {
      console.error('Failed to send webhook after multiple attempts');
    }
  }
}

function sleepRandomly() {
    // Generate a random number of milliseconds between 0 and 600000 (10 minutes)
    const milliseconds = Math.random() * 600000;

    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

await sleepRandomly();

main().catch(error => {
  console.error(error);
  process.exit(1);
});

