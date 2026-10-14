import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./account";
import dashboardRouter from "./dashboard";
import casesRouter from "./cases";
import documentsRouter from "./documents";
import storageRouter from "./storage";
import processRouter from "./process";
import aadhaarRouter from "./aadhaar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(dashboardRouter);
router.use(casesRouter);
router.use(documentsRouter);
router.use(storageRouter);
router.use(processRouter);
router.use(aadhaarRouter);

export default router;
