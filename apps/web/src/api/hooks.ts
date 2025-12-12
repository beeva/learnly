import type { AttemptInput, PreferencesInput, StartSessionInput, User } from "@learnly/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as client from "./client";

/*
 * Every mutation carries a stable `mutationKey` so cross-cutting concerns
 * (analytics, offline queueing) can observe them without touching screens.
 */
export const mutationKeys = {
  startSession: ["session", "start"] as const,
  nextItem: ["session", "next"] as const,
  completeSession: ["session", "complete"] as const,
  attempt: ["attempt"] as const,
  completeLesson: ["lesson", "complete"] as const,
  preferences: ["preferences"] as const,
};

export function useCourses() {
  return useQuery({ queryKey: client.queryKeys.courses, queryFn: client.api.courses, staleTime: 10 * 60_000 });
}

export function useCourse(slug: string | undefined) {
  return useQuery({
    queryKey: client.queryKeys.course(slug ?? ""),
    queryFn: () => client.api.course(slug ?? ""),
    enabled: Boolean(slug),
    staleTime: 10 * 60_000,
  });
}

export function lessonQueryOptions(lessonId: string) {
  return {
    queryKey: client.queryKeys.lesson(lessonId),
    queryFn: () => client.api.lesson(lessonId),
    // Lesson content changes rarely; keep it warm so revisits are instant.
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  };
}

export function useLesson(lessonId: string | undefined) {
  return useQuery({ ...lessonQueryOptions(lessonId ?? ""), enabled: Boolean(lessonId) });
}

export function useProgress() {
  return useQuery({ queryKey: client.learnerKeys.progress, queryFn: client.learnerApi.progress });
}

export function useRecommendations() {
  return useQuery({ queryKey: client.learnerKeys.recommendations, queryFn: client.learnerApi.recommendations });
}

export function useCourseMastery(slug: string | undefined) {
  return useQuery({
    queryKey: client.learnerKeys.courseMastery(slug ?? ""),
    queryFn: () => client.learnerApi.courseMastery(slug ?? ""),
    enabled: Boolean(slug),
  });
}

/** Progress, recommendations and mastery all move after learning activity. */
function useInvalidateLearning() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: client.learnerKeys.progress }),
      queryClient.invalidateQueries({ queryKey: client.learnerKeys.recommendations }),
      queryClient.invalidateQueries({ queryKey: ["course-mastery"] }),
    ]);
}

export function useStartSession() {
  return useMutation({ mutationKey: mutationKeys.startSession, mutationFn: (input: StartSessionInput) => client.learnerApi.startSession(input) });
}

export function useNextItem() {
  return useMutation({ mutationKey: mutationKeys.nextItem, mutationFn: (sessionId: string) => client.learnerApi.nextItem(sessionId) });
}

export function useCompleteSession() {
  const invalidate = useInvalidateLearning();
  return useMutation({
    mutationKey: mutationKeys.completeSession,
    mutationFn: (sessionId: string) => client.learnerApi.completeSession(sessionId),
    onSuccess: () => invalidate(),
  });
}

export function useSubmitAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.attempt,
    mutationFn: (input: AttemptInput) => client.learnerApi.submitAttempt(input),
    onSuccess: (result) => {
      // Keep the cached XP honest immediately; the full refresh happens at session end.
      queryClient.setQueryData<client.ProgressResponse>(client.learnerKeys.progress, (current) =>
        current
          ? {
              ...current,
              totalXp: current.totalXp + result.xpEarned,
              mastery: current.mastery.some((m) => m.skillId === result.mastery.skillId)
                ? current.mastery.map((m) => (m.skillId === result.mastery.skillId ? result.mastery : m))
                : [...current.mastery, result.mastery],
            }
          : current,
      );
    },
  });
}

export function useCompleteLesson() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLearning();
  return useMutation({
    mutationKey: mutationKeys.completeLesson,
    mutationFn: ({ lessonId, durationMs }: { lessonId: string; durationMs: number }) => client.learnerApi.completeLesson(lessonId, durationMs),
    onSuccess: (result) => {
      queryClient.setQueryData<client.ProgressResponse>(client.learnerKeys.progress, (current) =>
        current ? { ...current, ...result.progress } : current,
      );
      void invalidate();
    },
  });
}

/** Optimistically applies preference changes so toggles feel instant. */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.preferences,
    mutationFn: (input: PreferencesInput) => client.learnerApi.updatePreferences(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: client.queryKeys.me });
      const previous = queryClient.getQueryData<client.MeResponse>(client.queryKeys.me);
      if (previous) {
        const { displayName, avatarColor, ...prefs } = input;
        const user: User = {
          ...previous.user,
          ...(displayName ? { displayName } : {}),
          ...(avatarColor ? { avatarColor } : {}),
        };
        const preferences = Object.fromEntries(Object.entries(prefs).filter(([, value]) => value !== undefined));
        queryClient.setQueryData<client.MeResponse>(client.queryKeys.me, {
          user,
          preferences: { ...previous.preferences, ...preferences },
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(client.queryKeys.me, context.previous);
    },
    onSuccess: ({ preferences }) => {
      queryClient.setQueryData<client.MeResponse>(client.queryKeys.me, (current) => (current ? { ...current, preferences } : current));
      void queryClient.invalidateQueries({ queryKey: client.learnerKeys.progress });
    },
  });
}

type CreateClassroomInput = { name: string; courseId: string };

export function useClassrooms(enabled = true) {
  return useQuery({ queryKey: client.educatorKeys.classrooms, queryFn: client.educatorApi.classrooms, enabled });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["classroom", "create"],
    mutationFn: (input: CreateClassroomInput) => client.educatorApi.createClassroom(input),
    onSuccess: ({ classroom }) => {
      queryClient.setQueryData<{ classrooms: (typeof classroom)[] }>(client.educatorKeys.classrooms, (current) =>
        current ? { classrooms: [classroom, ...current.classrooms] } : { classrooms: [classroom] },
      );
    },
  });
}

export function useJoinClassroom() {
  return useMutation({ mutationKey: ["classroom", "join"], mutationFn: (joinCode: string) => client.educatorApi.joinClassroom(joinCode) });
}

export function useClassroomMembers(classroomId: string) {
  return useQuery({ queryKey: client.educatorKeys.members(classroomId), queryFn: () => client.educatorApi.members(classroomId) });
}

export function useClassroomInsights(classroomId: string, range: client.InsightsRange) {
  return useQuery({
    queryKey: client.educatorKeys.insights(classroomId, range),
    queryFn: () => client.educatorApi.insights(classroomId, range),
    // Changing the date range shouldn't flash the dashboard back to skeletons.
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  });
}

export function useClassroomHeatmap(classroomId: string) {
  return useQuery({ queryKey: client.educatorKeys.heatmap(classroomId), queryFn: () => client.educatorApi.heatmap(classroomId), staleTime: 60_000 });
}
