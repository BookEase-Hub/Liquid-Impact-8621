import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";
import { webhooksRouter } from "./webhooks";
import { authRouter } from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);
router.use("/webhooks", webhooksRouter);
router.use("/auth", authRouter);

export default router;
