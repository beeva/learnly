import { describe, expect, it } from "vitest";
import { tokenStore } from "../api/client";
import { DEMO_CREDENTIALS, renderWithProviders, screen } from "../test/render";
import { GuestOnly, RequireAuth, useAuth } from "./AuthProvider";

function SessionPanel() {
  const { status, user, signIn, signOut } = useAuth();
  return (
    <div>
      <p>Status: {status}</p>
      {user ? <p>Hello {user.displayName}</p> : null}
      <button type="button" onClick={() => void signIn(DEMO_CREDENTIALS.student)}>
        Sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("is anonymous without stored tokens", async () => {
    await renderWithProviders(<SessionPanel />);
    expect(screen.getByText("Status: anonymous")).toBeInTheDocument();
  });

  it("signs in, stores tokens and loads the profile", async () => {
    const { user } = await renderWithProviders(<SessionPanel />);
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Hello Maya Santos")).toBeInTheDocument();
    expect(screen.getByText("Status: authenticated")).toBeInTheDocument();
    expect(tokenStore.has()).toBe(true);
  });

  it("restores a session from stored tokens on load", async () => {
    await renderWithProviders(<SessionPanel />, { signedInAs: "educator" });
    expect(await screen.findByText("Hello Elena Rivera")).toBeInTheDocument();
  });

  it("signs out and forgets the session", async () => {
    const { user } = await renderWithProviders(<SessionPanel />, { signedInAs: "student" });
    await screen.findByText("Hello Maya Santos");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Status: anonymous")).toBeInTheDocument();
    expect(tokenStore.has()).toBe(false);
  });
});

describe("route guards", () => {
  it("sends guests to sign-in", async () => {
    await renderWithProviders(
      <RequireAuth>
        <p>Secret dashboard</p>
      </RequireAuth>,
      { route: "/secret", path: "/secret" },
    );
    expect(await screen.findByText("Sign-in page")).toBeInTheDocument();
    expect(screen.queryByText("Secret dashboard")).not.toBeInTheDocument();
  });

  it("lets signed-in users through", async () => {
    await renderWithProviders(
      <RequireAuth>
        <p>Secret dashboard</p>
      </RequireAuth>,
      { route: "/secret", path: "/secret", signedInAs: "student" },
    );
    expect(await screen.findByText("Secret dashboard")).toBeInTheDocument();
  });

  it("redirects roles that aren't allowed to their home", async () => {
    await renderWithProviders(
      <RequireAuth roles={["student"]}>
        <p>Student zone</p>
      </RequireAuth>,
      { route: "/zone", path: "/zone", signedInAs: "educator" },
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("keeps signed-in users away from guest pages", async () => {
    await renderWithProviders(
      <GuestOnly>
        <p>Sign-in form</p>
      </GuestOnly>,
      { route: "/login", path: "/login", signedInAs: "student" },
    );
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
});
