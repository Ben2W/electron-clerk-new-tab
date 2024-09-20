import { SignedIn, SignedOut, UserButton, useClerk } from "@clerk/clerk-react";

export default function ClerkSignInDemo() {
  const clerk = useClerk();
  return (
    <>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <button onClick={() => window.open(clerk.buildSignInUrl(), "_blank")}>
          Sign In
        </button>
      </SignedOut>
    </>
  );
}
