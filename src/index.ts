import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
  float64,
  Vec
} from "azle";
import { v4 as uuidv4 } from "uuid";

type Report = Record<{
  id: string;
  location: string;
  latitude: float64;
  longitude: float64;
  typeOfWaste: string;
  description: string;
  status: string;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
  reporterId: string; // ID of the user who reported the incident
}>;

// user
type User = Record<{
  id: string;
  username: string;
  email: string;
  persona: Principal;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type ReportPayload = Record<{
  location: string;
  latitude: float64;
  longitude: float64;
  typeOfWaste: string;
  status: string;
  description: string;
  reporterId: string;
  // Check if it is enum or you can add status
}>;

type UserPayload = Record<{
  username: string;
  email: string;
}>;

type ReportResponse = Record<{
  message: string;
  pinLocation: string;
}>;

// Creating instances of StableBTreeMap for the two entity types
const reportStr = new StableBTreeMap<string, Report>(0, 44, 512);
const userStr = new StableBTreeMap<string, User>(1, 44, 512);

// CRUD Operations
// Create a user instance
$update;
export function addUser(payload: UserPayload): Result<string, string> {
  try {
    if (!userStr.isEmpty()) {
      return Result.Err<string, string>("We currently have an active user");
    }

    const user: User = {
      id: uuidv4(),
      username: payload.username,
      email: payload.email,
      persona: ic.caller(),
      createdAt: ic.time(),
      updatedAt: Opt.None,
    };

    userStr.insert(user.id, user);
    return Result.Ok<string, string>(user.id);
  } catch (error) {
    return Result.Err<string, string>(`Error creating user: ${error}`);
  }
}

$update;
// This Function is to add a New Report
export function createNewReport(payload: ReportPayload): Result<string, string> {
  try {
    if (!isUser(ic.caller().toText())) {
      return Result.Err<string, string>("This can only be done by the contract owner");
    }

    // Validate payload
    if (
      !payload.location ||
      !payload.latitude ||
      !payload.longitude ||
      !payload.typeOfWaste ||
      !payload.status ||
      !payload.description ||
      !payload.reporterId
    ) {
      return Result.Err<string, string>("Invalid payload provided for creating a new report.");
    }

    // Check if payload.status is defined and not null or undefined
    if (payload.status !== null && payload.status !== undefined) {
      // Check if payload.status is a valid status type
      if (['pending', 'in_progress', 'resolved'].includes(payload.status)) {
        const report: Report = {
          id: uuidv4(),
          location: payload.location,
          latitude: payload.latitude,
          longitude: payload.longitude,
          typeOfWaste: payload.typeOfWaste,
          description: payload.description,
          status: payload.status,
          createdAt: ic.time(),
          updatedAt: Opt.None,
          reporterId: payload.reporterId,
        };

        reportStr.insert(report.id, report);
        return Result.Ok<string, string>(report.id);
      } else {
        return Result.Err<string, string>("Invalid status provided");
      }
    } else {
      return Result.Err<string, string>("Status is not defined in the payload");
    }
  } catch (error) {
    return Result.Err<string, string>(`Error creating new report: ${error}`);
  }
}

$update;
// Function to update information for Report
export function updateReport(id: string, payload: ReportPayload): Result<string, string> {
  try {
    if (!isUser(ic.caller().toText())) {
      return Result.Err<string, string>("This can only be done by the contract owner");
    }

    // Validate payload
    if (
      !payload.location ||
      !payload.latitude ||
      !payload.longitude ||
      !payload.typeOfWaste ||
      !payload.status ||
      !payload.description ||
      !payload.reporterId
    ) {
      return Result.Err<string, string>("Invalid payload provided for updating a report.");
    }

    const report = match(reportStr.get(id), {
      Some: (report) => report,
      None: () => null, // Return null instead of a string for non-existing reports
    });

    if (report !== null && typeof report !== 'string') {
      if (payload.status !== undefined && payload.status !== null) {
        if (['pending', 'in_progress', 'resolved'].includes(payload.status)) {
          report.location = payload.location;
          report.latitude = payload.latitude;
          report.longitude = payload.longitude;
          report.typeOfWaste = payload.typeOfWaste;
          report.status = payload.status;
          report.description = payload.description;
          report.reporterId = payload.reporterId;
          report.updatedAt = Opt.Some(ic.time());
          reportStr.insert(report.id, report);
          return Result.Ok<string, string>(report.id);
        } else {
          return Result.Err<string, string>("Invalid status provided");
        }
      } else {
        return Result.Err<string, string>("Status is not defined in the payload");
      }
    } else {
      return Result.Err<string, string>(`Report with id ${id} not available`);
    }
  } catch (error) {
    return Result.Err<string, string>(`Error updating report: ${error}`);
  }
}

// check if it is the correct user
function isUser(caller: string): boolean {
  const user = userStr.values()[0];
  return user.persona.toText() === caller;
}

$query;
// function to extract Report by Id
export function LocationForReportById(id: string): Result<ReportResponse, string> {
  try {
    return match(reportStr.get(id), {
      Some: (report) => {
        const point = `Your Report Geolocation is: ${report.longitude},${report.latitude}`;
        return Result.Ok<ReportResponse, string>({
          message: `report by id = ${id} has been found`,
          pinLocation: point,
        });
      },
      None: () => {
        return Result.Err<ReportResponse, string>(`We cannot find report by id = ${id}Location not found`,
        );
      },
    });
  } catch (error) {
    return Result.Err<ReportResponse, string>(`Error retrieving report: ${error}`);
  }
}

$query;
// Get all reports that have been made
export function getAllReports(): Result<Vec<Report>, string> {
  try {
    // Return all reports
    return Result.Ok<Vec<Report>, string>(reportStr.values());
  } catch (error) {
    return Result.Err<Vec<Report>, string>(`Error retrieving reports: ${error}`);
  }
}

$query;
// search report by status
export function searchByStatus(status: string): Result<Vec<Report>, string> {
  try {
    const statusReports = reportStr.values().filter((report) => report.status.toString().toLowerCase() === status.toString().toLowerCase());
    return Result.Ok<Vec<Report>, string>(statusReports);
  } catch (error) {
    return Result.Err<Vec<Report>, string>(`Error searching reports by status: ${error}`);
  }
}

$update;
// function to delete a Report
export function deleteReport(id: string): Result<string, string> {
  try {
    if (!id) {
      return Result.Err<string, string>("Invalid ID");
    }

    if (isUser(ic.caller().toText())) {
      return Result.Err<string, string>("This can only be done by contract owner");
    }

    reportStr.remove(id);
    return Result.Ok<string, string>(`Report with the : ${id} removed successfully`);
  } catch (error) {
    return Result.Err<string, string>(`Error deleting report: ${error}`);
  }
}

// Allow for the approving of the status to resolved
$update;
export function resolvedReport(id: string): Result<Report, string> {
  try {
    if (!id) {
      return Result.Err<Report, string>("Invalid ID");
    }
    
    return match(reportStr.get(id), {
      Some: (report) => {
        const resolvedReport: Report = { ...report, status: 'resolved' };
        reportStr.insert(report.id, resolvedReport);
        return Result.Ok<Report, string>(resolvedReport);
      },
      None: () => Result.Err<Report, string>(`Report with id:${id} not found`),
    });
  } catch (error) {
    return Result.Err<Report, string>(`Error resolving report: ${error}`);
  }
}

$query;
// get all Reports made by a Reporter ie ReporterId
export function getAllReportsByReporter(reporterId: string): Result<Vec<Report>, string> {
  try {
    if (!reporterId) {
      return Result.Err<Vec<Report>, string>("Invalid ID");
    }
    
    const allReporterReports = reportStr.values().filter((report) => report.reporterId.trim().toLowerCase() === reporterId.trim().toLowerCase());
    return Result.Ok<Vec<Report>, string>(allReporterReports);
  } catch (error) {
    return Result.Err<Vec<Report>, string>(`Error retrieving reports by reporter: ${error}`);
  }
}

// Mocking the 'crypto' object for testing purposes
globalThis.crypto = {
  // @ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
