import {
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
  useClerk,
} from "@clerk/clerk-react";

export default function ClerkSignInDemo() {
  const clerk = useClerk();
  const signInUrl = clerk.buildSignInUrl();
  return (
    <>
      <div className="text-red-500">{signInUrl}</div>
      <SignedIn>
        as
        <UserButton />
      </SignedIn>
      <SignedOut>
        <button onClick={() => window.open(signInUrl, "_blank")}>
          Sign In
        </button>
        <SignIn />
      </SignedOut>
    </>
  );
}
