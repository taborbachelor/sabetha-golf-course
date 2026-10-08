/**
 * 2026 tournament schedule, transcribed from the "Sabetha Country Club
 * Tournament Schedule" PDF linked on sabethagolfclub.com (2026-10-07).
 * Fees are shown exactly as printed (the PDF doesn't always say per team or
 * per person).
 */

export type Tournament = {
  date: string; // display date, e.g. "May 16"
  /** Last day of the event, "YYYY-MM-DD", to grey it out once it's past. */
  lastDay: string;
  month: string;
  name: string;
  time?: string;
  format?: string;
  fee?: string;
  note?: string;
};

export const tournamentYear = 2026;

export const tournaments: Tournament[] = [
  {
    month: "May",
    date: "May 16",
    lastDay: "2026-05-16",
    name: "Cloud Golf Tournament",
    format: "3-person scramble",
    fee: "$250",
  },
  {
    month: "May",
    date: "May 23",
    lastDay: "2026-05-23",
    name: "Memorial Day Tournament",
    format: "3-person scramble",
    fee: "$180",
  },
  {
    month: "June",
    date: "June 20",
    lastDay: "2026-06-20",
    name: "Knights of Columbus",
    format: "4-person scramble",
  },
  {
    month: "June",
    date: "June 27–28",
    lastDay: "2026-06-28",
    name: "Sabetha 2 Day Open",
    fee: "$130 per person",
    note: "Includes two lunches and a steak dinner. For tee times, contact the clubhouse or Noah Garber at 785-285-2087.",
  },
  {
    month: "July",
    date: "July 19",
    lastDay: "2026-07-19",
    time: "1:00pm",
    name: "Father Son",
    format: "9-hole, 2-person scramble",
    fee: "$40 per team",
  },
  {
    month: "July",
    date: "July 25",
    lastDay: "2026-07-25",
    name: "Taco Boys (Larry D. Meyer Memorial)",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 1",
    lastDay: "2026-08-01",
    time: "8:30am",
    name: "Club Fundraiser",
    format: "3-person scramble/shamble",
    fee: "$210 per team",
  },
  {
    month: "August",
    date: "August 8",
    lastDay: "2026-08-08",
    name: "Fairview Open",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 13",
    lastDay: "2026-08-13",
    name: "KANEB League",
    format: "2-person scramble",
  },
  {
    month: "August",
    date: "August 16",
    lastDay: "2026-08-16",
    time: "8:30am",
    name: "Club Championship",
    note: "Members only. Calcutta on August 14.",
  },
  {
    month: "August",
    date: "August 17",
    lastDay: "2026-08-17",
    name: "Shriners Tournament",
  },
  {
    month: "August",
    date: "August 22",
    lastDay: "2026-08-22",
    name: "Sabetha Community Hospital Tournament",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 29",
    lastDay: "2026-08-29",
    name: "Youth Tournament",
    format:
      "Middle school and younger: 2-person scramble. High school: 18 holes, own ball.",
  },
  {
    month: "September",
    date: "September 18",
    lastDay: "2026-09-18",
    name: "Sabetha Chamber",
    format: "3-person",
  },
  {
    month: "September",
    date: "September 19",
    lastDay: "2026-09-19",
    name: "Wenger Tournament",
  },
];
