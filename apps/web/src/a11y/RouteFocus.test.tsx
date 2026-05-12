import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Announcer, announce } from "./announcer";
import { RouteFocus, findRouteTarget, type RouterLike } from "./RouteFocus";

function fakeRouter(initialPath: string) {
  let listener: ((state: RouterLike["state"]) => void) | null = null;
  const router = {
    state: { location: { pathname: initialPath, search: "" }, navigation: { state: "idle" } } as RouterLike["state"],
    subscribe(fn: (state: RouterLike["state"]) => void) {
      listener = fn;
      return () => {
        listener = null;
      };
    },
    navigate(pathname: string, navigation: "idle" | "loading" = "idle") {
      router.state = { location: { pathname, search: "" }, navigation: { state: navigation } };
      act(() => listener?.(router.state));
    },
  };
  return router;
}

function dom(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("findRouteTarget", () => {
  it("prefers an explicit [data-route-focus] element", () => {
    const { target, title } = findRouteTarget(dom(`<main id="main"><h1>Heading</h1><h2 data-route-focus>Lesson title</h2></main>`));
    expect(target?.textContent).toBe("Lesson title");
    expect(title).toBe("Lesson title");
  });

  it("falls back to the main heading, then to main itself", () => {
    expect(findRouteTarget(dom(`<nav><h1>Nav</h1></nav><main><h1> Progress </h1></main>`)).title).toBe("Progress");
    const bare = findRouteTarget(dom(`<main id="main"><p>No heading</p></main>`));
    expect(bare.target?.tagName).toBe("MAIN");
    expect(bare.title).toBeNull();
  });
});

describe("RouteFocus", () => {
  function Page({ title, router }: { title: string; router: RouterLike }) {
    return (
      <>
        <nav>
          <a href="/progress">Progress</a>
        </nav>
        <main id="main">
          <h1>{title}</h1>
        </main>
        <RouteFocus router={router} />
        <Announcer />
      </>
    );
  }

  it("focuses the new page heading, updates the title and announces it", async () => {
    const router = fakeRouter("/home");
    const { rerender } = render(<Page title="Good morning, Maya" router={router} />);
    screen.getByRole("link", { name: "Progress" }).focus();

    rerender(<Page title="Progress" router={router} />);
    router.navigate("/progress");

    const heading = screen.getByRole("heading", { level: 1, name: "Progress" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(document.title).toBe("Progress · Learnly");
    await waitFor(() => expect(screen.getByTestId("announcer-polite")).toHaveTextContent("Progress"));
  });

  it("ignores in-flight navigations and same-path updates", async () => {
    const router = fakeRouter("/home");
    render(<Page title="Home" router={router} />);
    const link = screen.getByRole("link", { name: "Progress" });
    link.focus();

    router.navigate("/progress", "loading");
    router.navigate("/home");
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(link).toHaveFocus();
  });
});

describe("announce", () => {
  it("announces repeated messages and supports assertive alerts", async () => {
    render(<Announcer />);
    act(() => announce("Saved"));
    await waitFor(() => expect(screen.getByTestId("announcer-polite")).toHaveTextContent("Saved"));
    act(() => announce("Saved"));
    await waitFor(() => expect(screen.getByTestId("announcer-polite")).toHaveTextContent("Saved"));
    act(() => announce("Connection lost", "assertive"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Connection lost"));
  });
});
