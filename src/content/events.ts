/**
 * 2026 tournament schedule, transcribed from the "Sabetha Country Club
 * Tournament Schedule" PDF linked on sabethagolfclub.com (2026-10-07).
 * Fees are shown exactly as printed (the PDF doesn't always say per team or
 * per person).
 */

export type Tournament = {
  date: string; // display date, e.g. "May 16"
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
    name: "Cloud Golf Tournament",
    format: "3-person scramble",
    fee: "$250",
  },
  {
    month: "May",
    date: "May 23",
    name: "Memorial Day Tournament",
    format: "3-person scramble",
    fee: "$180",
  },
  {
    month: "June",
    date: "June 20",
    name: "Knights of Columbus",
    format: "4-person scramble",
  },
  {
    month: "June",
    date: "June 27–28",
    name: "Sabetha 2 Day Open",
    fee: "$130 per person",
    note: "Includes two lunches and a steak dinner. For tee times, contact the clubhouse or Noah Garber at 785-285-2087.",
  },
  {
    month: "July",
    date: "July 19",
    time: "1:00pm",
    name: "Father Son",
    format: "9-hole, 2-person scramble",
    fee: "$40 per team",
  },
  {
    month: "July",
    date: "July 25",
    name: "Taco Boys (Larry D. Meyer Memorial)",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 1",
    time: "8:30am",
    name: "Club Fundraiser",
    format: "3-person scramble/shamble",
    fee: "$210 per team",
  },
  {
    month: "August",
    date: "August 8",
    name: "Fairview Open",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 13",
    name: "KANEB League",
    format: "2-person scramble",
  },
  {
    month: "August",
    date: "August 16",
    time: "8:30am",
    name: "Club Championship",
    note: "Members only. Calcutta on August 14.",
  },
  { month: "August", date: "August 17", name: "Shriners Tournament" },
  {
    month: "August",
    date: "August 22",
    name: "Sabetha Community Hospital Tournament",
    format: "3-person scramble",
  },
  {
    month: "August",
    date: "August 29",
    name: "Youth Tournament",
    format:
      "Middle school and younger: 2-person scramble. High school: 18 holes, own ball.",
  },
  {
    month: "September",
    date: "September 18",
    name: "Sabetha Chamber",
    format: "3-person",
  },
  { month: "September", date: "September 19", name: "Wenger Tournament" },
];
