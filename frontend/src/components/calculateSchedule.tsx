import type { Vaccination } from "./columns"

export function calculateVaccinationSchedule<T extends Vaccination>(
    schedule: T[],
    birthDate: Date
  ): Vaccination[] {
    const unitMap: Record<string, number> = {
      week: 7,
      weeks: 7,
      month: 30,
      months: 30,
      year: 365,
      years: 365,
    }
  
    return schedule.map(item => {
      let offsetDays = 0
  
      if (item.age.toLowerCase() === "birth") {
        offsetDays = 0
      } else {
        const rangeRegex = /^(\d+)[–-](\d+)\s*(\w+)/i
        const singleRegex = /^(\d+)\s*(\w+)/i
  
        const rangeMatch = item.age.match(rangeRegex)
        if (rangeMatch) {
          const [, start, end, unit] = rangeMatch
          const avg = (parseInt(start) + parseInt(end)) / 2
          offsetDays = avg * (unitMap[unit.toLowerCase()] || 0)
        } else {
          const singleMatch = item.age.match(singleRegex)
          if (singleMatch) {
            const [, num, unit] = singleMatch
            offsetDays = parseInt(num) * (unitMap[unit.toLowerCase()] || 0)
          }
        }
      }
  
      const date = new Date(birthDate)
      date.setDate(date.getDate() + offsetDays)
  
      return {
        ...item,
        date_to_be_administered: date.toISOString().split("T")[0],
      }
    })
  }

  export function formatDateWithOrdinal(dateString: string): string {
    const date = new Date(dateString);
  
    const day = date.getDate();
    const month = date.toLocaleString("en-GB", { month: "long" });
    const year = date.getFullYear();
  
    const getOrdinal = (n: number) => {
      if (n > 3 && n < 21) return `${n}th`;
      switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
      }
    };
  
    return `${getOrdinal(day)} ${month} ${year}`;
  }
  