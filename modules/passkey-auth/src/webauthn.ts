// Thin seam over @simplewebauthn/server. The use-cases depend on these function
// shapes (not the library directly) so unit tests can inject fakes and assert
// orchestration — challenge lifecycle, counter/replay, persistence, events — WITHOUT
// running real attestation crypto. Production wires the real implementations below.
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

// Whether the authenticator must perform user verification (biometric/PIN) vs.
// mere user presence. Mirrors the WebAuthn spec value. Defaults to "preferred".
export type UserVerificationRequirement = "required" | "preferred" | "discouraged";

export interface GenerateRegistrationInput {
  rpName: string;
  rpId: string;
  userName: string;
  userDisplayName: string;
  excludeCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[];
  // Defaults to "preferred". Set "required" to force UV at registration.
  userVerification?: UserVerificationRequirement;
}

export interface VerifyRegistrationInput {
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string[];
  expectedRPID: string;
}

// Normalized registration result the use-case persists (decoupled from the lib's
// internal Uint8Array / nested shape).
export interface VerifiedRegistration {
  verified: boolean;
  credential?: {
    id: string; // base64url credential id
    publicKey: string; // base64url COSE public key
    counter: number;
    transports: string[];
    deviceType: string | null;
    backedUp: boolean;
  };
}

export interface GenerateAuthenticationInput {
  rpId: string;
  allowCredentials: { id: string; transports: AuthenticatorTransportFuture[] }[];
  // Defaults to "preferred". Set "required" to force UV (biometric/PIN) at login.
  userVerification?: UserVerificationRequirement;
}

export interface VerifyAuthenticationInput {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string[];
  expectedRPID: string;
  credential: {
    id: string; // base64url credential id
    publicKey: string; // base64url COSE public key
    counter: number;
    transports: string[];
  };
}

export interface VerifiedAuthentication {
  verified: boolean;
  newCounter: number;
  // Whether the authenticator actually performed user verification (biometric/PIN)
  // for this assertion. The use-case can require this when UV is mandatory.
  userVerified: boolean;
}

// The injectable verifier seam. Tests pass a fake; production passes realVerifiers.
export interface Verifiers {
  generateRegistration(input: GenerateRegistrationInput): Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration(input: VerifyRegistrationInput): Promise<VerifiedRegistration>;
  generateAuthentication(input: GenerateAuthenticationInput): Promise<PublicKeyCredentialRequestOptionsJSON>;
  verifyAuthentication(input: VerifyAuthenticationInput): Promise<VerifiedAuthentication>;
}

import { base64urlToUint8, uint8ToBase64url } from "./crypto";

// Real implementations wrapping @simplewebauthn/server (v11). Not exercised by unit
// tests; integration coverage with real ceremonies happens in api/.
export const realVerifiers: Verifiers = {
  async generateRegistration(input) {
    return generateRegistrationOptions({
      rpName: input.rpName,
      rpID: input.rpId,
      userName: input.userName,
      userDisplayName: input.userDisplayName,
      attestationType: "none",
      excludeCredentials: input.excludeCredentials.map((c) => ({
        id: c.id,
        transports: c.transports,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: input.userVerification ?? "preferred",
      },
    });
  },

  async verifyRegistration(input) {
    const verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: input.expectedRPID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return { verified: false };
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    return {
      verified: true,
      credential: {
        id: credential.id,
        publicKey: uint8ToBase64url(credential.publicKey),
        counter: credential.counter,
        transports: (credential.transports ?? []) as string[],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    };
  },

  async generateAuthentication(input) {
    return generateAuthenticationOptions({
      rpID: input.rpId,
      allowCredentials: input.allowCredentials.map((c) => ({ id: c.id, transports: c.transports })),
      userVerification: input.userVerification ?? "preferred",
    });
  },

  async verifyAuthentication(input) {
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: input.expectedChallenge,
      expectedOrigin: input.expectedOrigin,
      expectedRPID: input.expectedRPID,
      credential: {
        id: input.credential.id,
        publicKey: base64urlToUint8(input.credential.publicKey),
        counter: input.credential.counter,
        transports: input.credential.transports as AuthenticatorTransportFuture[],
      },
    });
    return {
      verified: verification.verified,
      newCounter: verification.authenticationInfo?.newCounter ?? input.credential.counter,
      userVerified: verification.authenticationInfo?.userVerified ?? false,
    };
  },
};
