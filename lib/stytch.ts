import * as stytch from 'stytch';

let client: stytch.Client;

export const getStytchClient = () => {
  if (!client) {
    client = new stytch.Client({
      project_id: process.env.STYTCH_PROJECT_ID || '',
      secret: process.env.STYTCH_SECRET || '',
      env: stytch.envs.test, // Use stytch.envs.live for production
    });
  }
  return client;
};

export default getStytchClient; 