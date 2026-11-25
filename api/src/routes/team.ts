import { USER_ROLE, ok, HTTPStatus } from "#const";
import { authMw, verifyPermission, type AuthEnv } from "#middleware/auth";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

export default new Hono<AuthEnv>().get(
  "/member",
  authMw,
  verifyPermission(USER_ROLE.TEACHER),
  async (c) => {
    const db = c.get("db");
    const teacherId = c.get("user").userId;
    const teacher = await db.query.user.findFirst({
      where: { id: teacherId, role: USER_ROLE.TEACHER },
      columns: { orgid: true },
    });
    if (!teacher?.orgid)
      throw new HTTPException(HTTPStatus.FORBIDDEN, {
        message: "No school assigned to your account",
      });
    const teacherTeam = await db.query.team.findFirst({
      where: { leaderId: teacherId, orgid: teacher.orgid },
      columns: { id: true, name: true },
      with: {
        teamMembers: {
          columns: {},
          where: { user: { orgid: teacher.orgid } },
          with: {
            user: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
    if (!teacherTeam)
      throw new HTTPException(HTTPStatus.NOT_FOUND, {
        message: "Team not found",
      });

    const users = teacherTeam.teamMembers
      .map(({ user }) => user)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return c.json(
      ok({
        teamId: teacherTeam.id,
        teamName: teacherTeam.name,
        ...(users.length > 0 && { users }),
      }),
      HTTPStatus.OK,
    );
  },
);
