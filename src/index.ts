import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal, float64} from 'azle';
import { v4 as uuidv4 } from 'uuid';



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

//user
type User = Record<{
    id: string;
    username: string;
    email: string;
    persona: Principal;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
}>;

type ReportPayload = Record<{
    location:string;
    latitude: float64;
    longitude: float64;
    typeOfWaste: string;
    status: string;
    description: string;
    reporterId: string;
    // Check if it is enum or you can add status

}>

type UserPayload = Record<{
    username: string;
    email: string;
}>

type ReportResponse = Record<{
    message: string;
    pinLocation: string;
}>

// Creating instances of StableBTreeMap for the two entity type
const reportStr = new StableBTreeMap<string, Report>(0, 44, 512);
const userStr = new StableBTreeMap<string, User>(1, 44, 512);

// CRUD Operations 
// Create a user instance 
$update;
export function addUser(payload: UserPayload): string {
  if (!userStr.isEmpty()) {
    return `We currently have an active user`;
  }
  const user = {
    id: uuidv4(),
    username: payload.username,
    email: payload.email,
    persona: ic.caller(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
  };
  userStr.insert(user.id, user);
  return user.id;
}
$update;
//this Function is to add a New Report 
export function createNewReport(payload: ReportPayload): string {
  if (!isUser(ic.caller().toText())) {
    return `This can only be done by the contract owner`;
  }


  // Check if payload.status is defined and not null or undefined
  if (payload.status !== null && payload.status !== undefined) {
      // Check if payload.status is a valid status type
      if (['pending', 'in_progress', 'resolved'].includes(payload.status)) {
          const report = {
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
          return report.id;
      } else {
          return `Invalid status provided`;
      }
  } else {
      return `Status is not defined in the payload`;
  }
}
$update;
// Function to update information for Report
export function updateReport(id: string, payload: ReportPayload): string {
  if (!isUser(ic.caller().toText())) {
    return "This can only be done by the contract owner";
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
        return report.id;
      } else {
        return `Invalid status provided`;
      }
    } else {
      return `Status is not defined in the payload`;
    }
  } else {
    return `Report with id ${id} not available`;
  }
}




// check if it is the correct user 
function isUser(caller: string): boolean {
    const user = userStr.values()[0];
    return user.persona.toText() === caller;
}

$query;
// function to extract Report by Id 
export function LocationForReportById(id: string): ReportResponse {
    return match(reportStr.get(id), {
        Some: (report) => {
            const point = `Your Report Geolocation is: ${report.longitude},${report.latitude}`
            return {
                message: `report by id = ${id} has been found`,
                pinLocation: point
            }
        },
        None: () => {
            return {
              message: `We can not find report by id = ${id}`,
              pinLocation: "Loction not found"
            };
        }
    });
}

$query;
//Get all reports that have been made 
export function getAllReports(): Result<Vec<Report>, string> {
  
  const allReports = reportStr.values()
  return Result.Ok(allReports);
}

$query;
//search report by status
export function searchByStatus(status: string): Result<Vec<Report>, string> {
    const statusReports = reportStr.values().filter((report) => report.status.toString().toLowerCase() === status.toString().toLowerCase());
    return Result.Ok(statusReports);
}

$update;
// function to delete a Report 
export function deleteReport(id: string): string {
  if (isUser(ic.caller().toText())) {
    return "This can only be done by contract owner";
  }
  reportStr.remove(id);
  return `Report with the : ${id} removed successfully`;
}

// Allow for the approving of the status to resolved 
$update
export function resolvedReport(id: string): Result<Report, string> {
    return match(reportStr.get(id), {
        Some: (report) => {
            const resolvedReport: Report = { ...report, status:'resolved' };
            reportStr.insert(report.id, resolvedReport);
            return Result.Ok<Report, string>(resolvedReport);
        },
        None: () => Result.Err<Report, string>(`Report with id:${id} not found`),
    });
}


$query; 
// get all Reports made by a Reporter ie ReporterId
export function getAllReportsByReporter(reporterId: string): Result<Vec<Report>, string> {
  
  const allReporterReports = reportStr.values().filter((report) => report.reporterId.trim().toLowerCase() === reporterId.trim().toLowerCase())
  return Result.Ok(allReporterReports);
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
