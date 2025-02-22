import { onError } from 'server/middlewares/error';
import { CreateRouter } from '@linen/auth/server';
import {
  githubSignIn,
  loginPassport,
  magicLink,
  magicLinkStrategy,
  passport,
} from '../auth';
import jwtMiddleware from 'server/middlewares/jwt';
import { ApiEvent, trackApiEvent } from 'utilities/ssr-metrics';
import { normalize } from '@linen/utilities/string';
import {
  acceptInvite,
  findInvitesByEmail,
  joinCommunityAfterSignIn,
} from 'services/invites';
import { createSsoSession, getSsoSession } from 'services/sso';

async function acceptInvites(userEmail: string) {
  // accept invites
  const invites = await findInvitesByEmail(userEmail);
  for (const invite of invites) {
    await acceptInvite(invite.id, userEmail).catch(console.error);
  }
}

const prefix = '/api/auth';

const authRouter = CreateRouter({
  prefix,
  githubSignIn,
  jwtMiddleware,
  loginPassport,
  magicLink,
  magicLinkStrategy,
  onCredentialsLogin: async (req, res, user) => {
    await acceptInvites(user.email);
    await trackApiEvent({ req, res }, ApiEvent.sign_in, {
      provider: 'credentials',
    });
  },
  onGithubLogin: async (req, res, user) => {
    await acceptInvites(user.email);
    if (user.state) {
      // join community
      await joinCommunityAfterSignIn({
        request: req,
        response: res,
        communityId: user.state,
        authId: user.id,
        displayName: normalize(
          user.displayName || user.email.split('@').shift() || user.email
        ),
        profileImageUrl: user.profileImageUrl,
      });
    }
    await trackApiEvent({ req, res }, ApiEvent.sign_in, {
      provider: 'github',
    });
  },
  onMagicLinkLogin: async (req, res, user) => {
    const state = user.state;
    const displayName = normalize(
      user.displayName || user.email.split('@').shift() || user.email
    );
    await acceptInvites(user.email);
    if (state) {
      // join community
      await joinCommunityAfterSignIn({
        request: req,
        response: res,
        communityId: state,
        authId: user.id,
        displayName,
      });
    }
    await trackApiEvent({ req, res }, ApiEvent.sign_in, {
      provider: 'magic-link',
    });
  },
  onSignOut: async (req, res) => {
    await trackApiEvent({ req, res }, ApiEvent.sign_out);
  },
  passport,
  createSsoSession,
  getSsoSession,
});
authRouter.use(onError);

export default authRouter;
