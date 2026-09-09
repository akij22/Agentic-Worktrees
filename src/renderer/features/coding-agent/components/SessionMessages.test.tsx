import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CodingAgentMessageDto } from "../../../../shared/ipc/schemas";
import { SessionMessages } from "./SessionMessages";

const reasoningMessage = (): CodingAgentMessageDto => ({
    id: "a1",
    role: "assistant",
    content: "",
    reasoning: "Inspecting the failing test.",
    tools: [],
    createdAt: 0,
    completedAt: null,
});

describe("SessionMessages", () => {
    it("renders a transient context-compaction thought", () => {
        const markup = renderToStaticMarkup(
            <SessionMessages
                agentName="Codex"
                messages={[]}
                busy
                activity={undefined}
                transientThought="Compacting context..."
                permission={undefined}
                error={undefined}
                onRespondPermission={() => undefined}
            />,
        );

        expect(markup).toContain("Compacting context...");
        expect(markup).toContain("min-h-0");
        expect(markup).toContain("overflow-y-auto");
        expect(markup).toContain("overscroll-contain");
        expect(markup).toContain("bg-background");
    });

    it("shows the streaming thinking treatment for an open reasoning stream while busy", () => {
        const markup = renderToStaticMarkup(
            <SessionMessages
                agentName="Codex"
                messages={[reasoningMessage()]}
                busy
                activity={undefined}
                transientThought={undefined}
                permission={undefined}
                error={undefined}
                onRespondPermission={() => undefined}
            />,
        );

        expect(markup).toContain("thought-shimmer");
        expect(markup).toContain("Inspecting the failing test.");
    });

    it("renders completed reasoning without the streaming treatment once idle", () => {
        const markup = renderToStaticMarkup(
            <SessionMessages
                agentName="Codex"
                messages={[reasoningMessage()]}
                busy={false}
                activity={undefined}
                transientThought={undefined}
                permission={undefined}
                error={undefined}
                onRespondPermission={() => undefined}
            />,
        );

        expect(markup).toContain("was thinking");
        expect(markup).not.toContain("thought-shimmer");
    });

    it("renders Markdown in transient activity without exposing syntax", () => {
        const markup = renderToStaticMarkup(
            <SessionMessages
                agentName="Codex"
                messages={[]}
                busy
                activity="Thinking… **Using fetch_url**"
                transientThought={undefined}
                permission={undefined}
                error={undefined}
                onRespondPermission={() => undefined}
            />,
        );

        expect(markup).toContain("Using fetch_url");
        expect(markup).toContain("<strong");
        expect(markup).not.toContain("**Using fetch_url**");
    });

    it("keeps user messages sized to their content", () => {
        const markup = renderToStaticMarkup(
            <SessionMessages
                agentName="Codex"
                messages={[
                    {
                        id: "u1",
                        role: "user",
                        content: "Short note",
                        reasoning: "",
                        tools: [],
                        createdAt: 0,
                        completedAt: null,
                    },
                ]}
                busy={false}
                activity={undefined}
                transientThought={undefined}
                permission={undefined}
                error={undefined}
                onRespondPermission={() => undefined}
            />,
        );

        expect(markup).toContain("w-fit");
        expect(markup).toContain("text-right");
    });

    it.each([
        ["requested", "Requested skill: Security Review"],
        ["loaded", "Loaded skill: Security Review"],
        ["failed", "Failed skill: Security Review"],
    ] as const)("renders honest %s skill state", (status, copy) => {
        const markup = renderToStaticMarkup(
            <SessionMessages agentName="Codex" messages={[]} busy={false} activity={undefined}
                permission={undefined} error={undefined} onRespondPermission={() => undefined}
                skillInvocations={[{ id: "inv-1", skillId: "security-review", name: "Security Review", version: "1", mode: "explicit", status, requestedAt: new Date(0).toISOString() }]} />,
        );
        expect(markup).toContain(copy);
    });

});
