import { createClassroomSchema } from "@learnly/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isApiError } from "../../api/client";
import { useCourses, useCreateClassroom } from "../../api/hooks";
import { useT } from "../../i18n/I18nProvider";
import { Button, Dialog, Field, Input, Select, useToast } from "../../ui/components";
import { CheckIcon, PlusIcon } from "../../ui/icons";
import styles from "./Classrooms.module.css";

export interface CreateClassroomDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClassroomDialog({ open, onClose }: CreateClassroomDialogProps) {
  const { t } = useT();
  const { toast } = useToast();
  const courses = useCourses();
  const create = useCreateClassroom();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; courseId?: string; form?: string }>({});

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName("");
    setErrors({});
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!courseId && courses.data?.courses[0]) setCourseId(courses.data.courses[0].id);
  }, [courseId, courses.data]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = createClassroomSchema.safeParse({ name, courseId });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        ...(fields.name ? { name: name.trim().length === 0 ? t("educator.create.nameRequired") : t("educator.create.nameLength") } : {}),
        ...(fields.courseId ? { courseId: t("educator.create.courseRequired") } : {}),
      });
      if (fields.name) nameRef.current?.focus();
      return;
    }
    setErrors({});
    try {
      const { classroom } = await create.mutateAsync(parsed.data);
      toast({
        tone: "success",
        icon: CheckIcon,
        title: t("educator.create.success", { name: classroom.name }),
        description: t("educator.create.successCode", { code: classroom.joinCode }),
        durationMs: 7000,
      });
      onClose();
    } catch (error) {
      setErrors({ form: isApiError(error) ? error.message : t("educator.create.failed") });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("educator.create.title")}
      description={t("educator.create.description")}
      initialFocusRef={nameRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="create-classroom" leadingIcon={PlusIcon} loading={create.isPending}>
            {t("educator.create.submit")}
          </Button>
        </>
      }
    >
      <form id="create-classroom" className={styles.createForm} onSubmit={(event) => void onSubmit(event)} noValidate>
        {errors.form ? (
          <p className={styles.formError} role="alert">
            {errors.form}
          </p>
        ) : null}
        <Field label={t("educator.create.name")} hint={t("educator.create.nameHint")} error={errors.name} required>
          {(control) => (
            <Input
              {...control}
              ref={nameRef}
              value={name}
              maxLength={80}
              placeholder={t("educator.create.namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("educator.create.course")} hint={t("educator.create.courseHint")} error={errors.courseId} required>
          {(control) => (
            <Select {...control} value={courseId} disabled={courses.isPending} onChange={(event) => setCourseId(event.target.value)}>
              {courses.isPending ? <option value="">{t("common.loading")}</option> : null}
              {(courses.data?.courses ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
