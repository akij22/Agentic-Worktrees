// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapabilityChangedEventDto } from "../../../../shared/ipc/schemas";
import { useCapabilities } from "./useCapabilities";

afterEach(() => vi.restoreAllMocks());
function api() { let listener:((event:CapabilityChangedEventDto)=>void)|undefined; const value={capabilities:{list:vi.fn().mockResolvedValue([]),get:vi.fn(),configure:vi.fn(),activate:vi.fn(),deactivate:vi.fn(),onChanged:vi.fn((next:(event:CapabilityChangedEventDto)=>void)=>{listener=next;return vi.fn()})}};Object.defineProperty(window,"api",{configurable:true,value});return {value,emit:(event:CapabilityChangedEventDto)=>listener?.(event)}; }
describe("useCapabilities", () => {
 it("loads and subscribes once without leaking the listener", async () => { const fixture=api(); const { unmount }=renderHook(()=>useCapabilities()); await waitFor(()=>expect(fixture.value.capabilities.list).toHaveBeenCalledOnce()); expect(fixture.value.capabilities.onChanged).toHaveBeenCalledOnce(); const unsubscribe=fixture.value.capabilities.onChanged.mock.results[0].value; unmount(); expect(unsubscribe).toHaveBeenCalledOnce(); });
 it("routes catalog globally and session events only to the matching run",async()=>{const fixture=api();renderHook(()=>useCapabilities("run-1"));await waitFor(()=>expect(fixture.value.capabilities.list).toHaveBeenCalledTimes(1));act(()=>fixture.emit({scope:"session",runId:"run-2",capabilityId:"agentic-worktrees.web-search",state:"active",updatedAt:"2026-09-02T00:00:00.000Z"}));expect(fixture.value.capabilities.list).toHaveBeenCalledTimes(1);act(()=>fixture.emit({scope:"session",runId:"run-1",capabilityId:"agentic-worktrees.web-search",state:"active",updatedAt:"2026-09-02T00:00:00.000Z"}));await waitFor(()=>expect(fixture.value.capabilities.list).toHaveBeenCalledTimes(2));act(()=>fixture.emit({scope:"catalog",capabilityId:"agentic-worktrees.web-search",change:"updated",updatedAt:"2026-09-02T00:00:00.000Z"}));await waitFor(()=>expect(fixture.value.capabilities.list).toHaveBeenCalledTimes(3));});
});
