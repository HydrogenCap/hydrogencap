export const CHAT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_property_details",
      description:
        "Get detailed information about a specific property including financials, compliance, tenants, and rooms",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string", description: "The property UUID" },
          include: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "financials",
                "compliance",
                "tenants",
                "rooms",
                "loans",
                "all",
              ],
            },
            description: "What data to include",
          },
        },
        required: ["property_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_compliance_task",
      description:
        "Create a compliance task or reminder for a property. Always ask the user to confirm before calling this.",
      parameters: {
        type: "object",
        properties: {
          property_id: { type: "string" },
          task_type: {
            type: "string",
            enum: [
              "renewal_due",
              "expired",
              "missing_document",
              "new_requirement",
              "follow_up",
              "inspection_scheduled",
              "certificate_received",
              "upload_pending",
            ],
          },
          title: { type: "string" },
          due_date: { type: "string", format: "date" },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          description: { type: "string" },
        },
        required: ["property_id", "title", "due_date"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_portfolio_metrics",
      description:
        "Calculate specific portfolio metrics like yield, LTV, equity, cashflow for the whole portfolio or specific properties",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: [
              "gross_yield",
              "net_yield",
              "ltv",
              "equity",
              "cashflow",
              "roi",
              "all",
            ],
          },
          property_ids: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional: specific property IDs. Omit for portfolio-wide.",
          },
          period: {
            type: "string",
            enum: ["current", "annual", "monthly"],
          },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_properties",
      description: "Search and filter properties by criteria",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free text search (address, postcode)",
          },
          filters: {
            type: "object",
            properties: {
              property_type: { type: "string" },
              min_value: { type: "number" },
              max_value: { type: "number" },
              min_beds: { type: "number" },
              compliance_status: {
                type: "string",
                enum: ["compliant", "expiring", "expired"],
              },
              lifecycle: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_report",
      description:
        "Generate a portfolio report (compliance summary, financial overview, rent roll)",
      parameters: {
        type: "object",
        properties: {
          report_type: {
            type: "string",
            enum: [
              "compliance_summary",
              "financial_overview",
              "rent_roll",
              "portfolio_snapshot",
            ],
          },
          property_ids: {
            type: "array",
            items: { type: "string" },
            description: "Optional: specific properties",
          },
          format: {
            type: "string",
            enum: ["text", "table"],
            description: "Output format",
          },
        },
        required: ["report_type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "schedule_reminder",
      description:
        "Schedule a reminder for the user about a property or task. Always ask the user to confirm before calling this.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          remind_at: { type: "string", format: "date-time" },
          property_id: {
            type: "string",
            description: "Optional: linked property",
          },
        },
        required: ["title", "remind_at"],
      },
    },
  },
];
