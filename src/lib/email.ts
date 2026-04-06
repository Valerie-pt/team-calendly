import emailjs from "emailjs-com";
import { generateGoogleCalendarUrl } from "@/lib/calendar";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
const CANDIDATE_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_CANDIDATE_TEMPLATE_ID || "";
const INTERVIEWER_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_INTERVIEWER_TEMPLATE_ID || "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

export async function sendBookingEmails(params: {
  candidate_name: string;
  candidate_email: string;
  interviewer_name: string;
  interviewer_email: string;
  date: string;
  time: string;
  duration_minutes: number;
  zoom_link: string;
}) {
  if (!SERVICE_ID || !PUBLIC_KEY) {
    console.warn("EmailJS not configured, skipping emails");
    return;
  }

  const eventTitle = `Interview: ${params.candidate_name} & ${params.interviewer_name}`;
  const googleCalendarUrl = generateGoogleCalendarUrl({
    title: eventTitle,
    date: params.date,
    time: params.time,
    duration_minutes: params.duration_minutes,
    description: `Interview meeting\nZoom: ${params.zoom_link}`,
    location: params.zoom_link,
  });

  const templateParams = {
    candidate_name: params.candidate_name,
    candidate_email: params.candidate_email,
    interviewer_name: params.interviewer_name,
    interviewer_email: params.interviewer_email,
    date: params.date,
    time: `${params.time} MSK`,
    duration: `${params.duration_minutes} min`,
    zoom_link: params.zoom_link,
    google_calendar_url: googleCalendarUrl,
  };

  const promises: Promise<unknown>[] = [];

  if (CANDIDATE_TEMPLATE_ID) {
    promises.push(
      emailjs.send(SERVICE_ID, CANDIDATE_TEMPLATE_ID, {
        ...templateParams,
        to_email: params.candidate_email,
        to_name: params.candidate_name,
      }, PUBLIC_KEY)
    );
  }

  if (INTERVIEWER_TEMPLATE_ID) {
    promises.push(
      emailjs.send(SERVICE_ID, INTERVIEWER_TEMPLATE_ID, {
        ...templateParams,
        to_email: params.interviewer_email,
        to_name: params.interviewer_name,
      }, PUBLIC_KEY)
    );
  }

  await Promise.allSettled(promises);
}
