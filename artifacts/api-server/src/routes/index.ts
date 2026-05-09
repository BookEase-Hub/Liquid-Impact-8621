import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scansRouter from "./scans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scansRouter);

export default router;
